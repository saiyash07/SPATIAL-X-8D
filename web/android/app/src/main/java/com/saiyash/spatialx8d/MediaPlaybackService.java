package com.saiyash.spatialx8d;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.media.AudioManager;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.MediaPlayer;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.util.Log;
import android.widget.RemoteViews;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class MediaPlaybackService extends Service {
    private static final String CHANNEL_ID = "SpatialX8D_Playback_Channel_V4";
    private static final int NOTIFICATION_ID = 8013;
    private static final String TAG = "SPATIAL_X";
    
    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;
    
    private MediaSessionCompat mediaSession;
    
    // Metadata states
    private String currentTitle = "Spatial X 8D";
    private String currentArtist = "Background Playback";
    private String currentArtworkUrl = "";
    private double currentDuration = 0;
    private Bitmap currentArtworkBitmap = null;
    
    // Playback states
    private boolean isPlaying = false;
    private double currentPosition = 0;
    private boolean isRepeat = false;
    
    // Native MediaPlayer for streaming background audio
    private MediaPlayer mediaPlayer = null;
    private String currentStreamUrl = "";
    private float masterVolume = 0.85f;
    private float rotationSpeed = 0.5f; // Hz
    private double panningAngle = 0.0;

    private AudioManager audioManager;
    private AudioManager.OnAudioFocusChangeListener audioFocusChangeListener;
    private AudioFocusRequest audioFocusRequest;
    private boolean hasAudioFocus = false;
    private boolean isBackground = false;

    // 50Hz Panning loop Handler
    private final android.os.Handler panningHandler = new android.os.Handler();
    private final Runnable panningRunnable = new Runnable() {
        @Override
        public void run() {
            updatePanning();
            panningHandler.postDelayed(this, 20); // 50Hz (20ms interval)
        }
    };

    // Progress update loop Handler
    private final android.os.Handler progressHandler = new android.os.Handler();
    private final Runnable progressRunnable = new Runnable() {
        @Override
        public void run() {
            updateProgress();
            progressHandler.postDelayed(this, 500); // 500ms interval
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "MediaPlaybackService onCreate");
        
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        audioFocusChangeListener = new AudioManager.OnAudioFocusChangeListener() {
            @Override
            public void onAudioFocusChange(int focusChange) {
                Log.d(TAG, "onAudioFocusChange: " + focusChange);
                switch (focusChange) {
                    case AudioManager.AUDIOFOCUS_LOSS:
                    case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT:
                    case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK:
                        Log.d(TAG, "Audio focus lost, pausing playback");
                        pauseNativePlayback();
                        break;
                    case AudioManager.AUDIOFOCUS_GAIN:
                        Log.d(TAG, "Audio focus gained, resuming playback");
                        resumeNativePlayback();
                        break;
                }
            }
        };

        // Create Notification Channel for Android 8.0+ with IMPORTANCE_DEFAULT for lockscreen visibility
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Spatial X 8D Playback Service",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            channel.setDescription("Keeps audio playback active in the background");
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }

        // Acquire WakeLock to keep CPU running
        PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (powerManager != null) {
            wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "SpatialX8D::PlaybackWakeLock");
            wakeLock.acquire();
            Log.d(TAG, "WakeLock acquired");
        }

        // Acquire WifiLock to keep Wifi active
        WifiManager wifiManager = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
        if (wifiManager != null) {
            wifiLock = wifiManager.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "SpatialX8D::PlaybackWifiLock");
            wifiLock.acquire();
            Log.d(TAG, "WifiLock acquired");
        }

        // Initialize Media Session
        mediaSession = new MediaSessionCompat(this, "SpatialX8D");
        mediaSession.setFlags(
            MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS |
            MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
        );

        // Session Activity configuration
        Intent launchIntent = new Intent(this, MainActivity.class);
        PendingIntent sessionActivity = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );
        mediaSession.setSessionActivity(sessionActivity);

        // Media Button Receiver pending intent registration
        Intent mediaButtonIntent = new Intent(Intent.ACTION_MEDIA_BUTTON);
        mediaButtonIntent.setClass(this, androidx.media.session.MediaButtonReceiver.class);
        int mediaButtonFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            mediaButtonFlags |= PendingIntent.FLAG_MUTABLE;
        } else {
            mediaButtonFlags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent mediaButtonPendingIntent = PendingIntent.getBroadcast(
            this,
            0,
            mediaButtonIntent,
            mediaButtonFlags
        );
        mediaSession.setMediaButtonReceiver(mediaButtonPendingIntent);

        mediaSession.setCallback(new MediaSessionCompat.Callback() {
            @Override
            public void onPlay() {
                Log.d(TAG, "MediaSession onPlay Callback");
                resumeNativePlayback();
            }

            @Override
            public void onPause() {
                Log.d(TAG, "MediaSession onPause Callback");
                pauseNativePlayback();
            }

            @Override
            public void onSkipToNext() {
                Log.d(TAG, "MediaSession onSkipToNext Callback");
                triggerJSEvent("mediaNext");
            }

            @Override
            public void onSkipToPrevious() {
                Log.d(TAG, "MediaSession onSkipToPrevious Callback");
                triggerJSEvent("mediaPrev");
            }

            @Override
            public void onSeekTo(long pos) {
                Log.d(TAG, "MediaSession onSeekTo Callback: " + pos);
                seekNativePlayback(pos / 1000.0);
            }
        });
        mediaSession.setActive(true);
        Log.d(TAG, "MediaSession created and activated");
    }

    private void triggerJSEvent(final String eventName) {
        Log.d(TAG, "triggerJSEvent: " + eventName);
        MainActivity activity = MainActivity.getInstance();
        if (activity != null && activity.getBridge() != null && activity.getBridge().getWebView() != null) {
            activity.getBridge().getWebView().post(new Runnable() {
                @Override
                public void run() {
                    activity.getBridge().getWebView().evaluateJavascript(
                        "window.dispatchEvent(new CustomEvent('" + eventName + "'));", null
                    );
                }
            });
        } else {
            Log.w(TAG, "Cannot trigger JS event " + eventName + " - MainActivity/WebView unavailable");
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            Log.d(TAG, "onStartCommand action: " + action);

            if (Intent.ACTION_MEDIA_BUTTON.equals(action)) {
                Log.d(TAG, "Handling MEDIA_BUTTON intent broadcast");
                androidx.media.session.MediaButtonReceiver.handleIntent(mediaSession, intent);
            } else if ("PLAY_URI".equals(action)) {
                String url = intent.getStringExtra("url");
                String title = intent.getStringExtra("title");
                String artist = intent.getStringExtra("artist");
                String artwork = intent.getStringExtra("artwork");
                double duration = intent.getDoubleExtra("duration", 0);

                currentTitle = title != null ? title : "Spatial X 8D";
                currentArtist = artist != null ? artist : "Background Playback";
                currentDuration = duration;

                if (artwork != null && !artwork.equals(currentArtworkUrl)) {
                    currentArtworkUrl = artwork;
                    downloadArtwork(artwork);
                }

                playNativeUri(url);
            } else if ("PAUSE_URI".equals(action)) {
                pauseNativePlayback();
            } else if ("RESUME_URI".equals(action)) {
                resumeNativePlayback();
            } else if ("NEXT_TRACK".equals(action)) {
                triggerJSEvent("mediaNext");
            } else if ("PREV_TRACK".equals(action)) {
                triggerJSEvent("mediaPrev");
            } else if ("SEEK_URI".equals(action)) {
                double pos = intent.getDoubleExtra("position", 0);
                seekNativePlayback(pos);
            } else if ("SET_VOLUME_URI".equals(action)) {
                masterVolume = intent.getFloatExtra("volume", 0.85f);
            } else if ("SET_ROTATION_SPEED_URI".equals(action)) {
                rotationSpeed = intent.getFloatExtra("speed", 0.5f);
            } else if ("SET_REPEAT_URI".equals(action)) {
                isRepeat = intent.getBooleanExtra("repeat", false);
                updateMediaSessionAndNotification();
            } else if ("TOGGLE_REPEAT_URI".equals(action)) {
                isRepeat = !isRepeat;
                triggerJSEvent(isRepeat ? "mediaRepeatActive" : "mediaRepeatInactive");
                updateMediaSessionAndNotification();
            } else if ("UPDATE_METADATA".equals(action)) {
                String title = intent.getStringExtra("title");
                String artist = intent.getStringExtra("artist");
                String artwork = intent.getStringExtra("artwork");
                double duration = intent.getDoubleExtra("duration", 0);
                
                currentTitle = title != null ? title : "Spatial X 8D";
                currentArtist = artist != null ? artist : "Background Playback";
                currentDuration = duration;

                if (artwork != null && !artwork.equals(currentArtworkUrl)) {
                    currentArtworkUrl = artwork;
                    downloadArtwork(artwork);
                } else {
                    updateMediaSessionAndNotification();
                }
            } else if ("SET_BACKGROUND".equals(action)) {
                isBackground = intent.getBooleanExtra("background", false);
                updateMediaSessionAndNotification();
            }
        }

        // Keep service alive in foreground
        Notification notification = buildMediaNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        return START_STICKY;
    }

    private void playNativeUri(String url) {
        if (url == null || url.isEmpty()) return;
        Log.d(TAG, "playNativeUri: " + url);
        currentStreamUrl = url;

        // Clean up previous MediaPlayer
        releaseMediaPlayer();

        try {
            // Request Audio Focus before playback starts
            requestAudioFocus();

            mediaPlayer = new MediaPlayer();
            mediaPlayer.setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build());

            mediaPlayer.setDataSource(url);
            mediaPlayer.setWakeMode(getApplicationContext(), PowerManager.PARTIAL_WAKE_LOCK);
            mediaPlayer.setOnPreparedListener(new MediaPlayer.OnPreparedListener() {
                @Override
                public void onPrepared(MediaPlayer mp) {
                    Log.d(TAG, "MediaPlayer onPrepared. Starting playback");
                    mp.start();
                    isPlaying = true;
                    currentDuration = mp.getDuration() / 1000.0;
                    
                    // Start loops
                    startPanningLoop();
                    startProgressLoop();

                    // Update UI via dispatch events
                    triggerJSEvent("mediaPlay");
                    updateMediaSessionAndNotification();
                }
            });

            mediaPlayer.setOnCompletionListener(new MediaPlayer.OnCompletionListener() {
                @Override
                public void onCompletion(MediaPlayer mp) {
                    Log.d(TAG, "MediaPlayer onCompletion");
                    if (isRepeat) {
                        Log.d(TAG, "Repeat active, looping track");
                        seekNativePlayback(0);
                        if (mediaPlayer != null) {
                            mediaPlayer.start();
                            isPlaying = true;
                            startPanningLoop();
                            startProgressLoop();
                            triggerJSEvent("mediaPlay");
                            updateMediaSessionAndNotification();
                        }
                    } else {
                        isPlaying = false;
                        stopPanningLoop();
                        stopProgressLoop();
                        triggerJSEvent("mediaEnded");
                        updateMediaSessionAndNotification();
                    }
                }
            });

            mediaPlayer.setOnErrorListener(new MediaPlayer.OnErrorListener() {
                @Override
                public boolean onError(MediaPlayer mp, int what, int extra) {
                    Log.e(TAG, "MediaPlayer onError: " + what + ", " + extra);
                    isPlaying = false;
                    stopPanningLoop();
                    stopProgressLoop();
                    triggerJSEvent("mediaError");
                    updateMediaSessionAndNotification();
                    return true;
                }
            });

            mediaPlayer.prepareAsync();
        } catch (Exception e) {
            Log.e(TAG, "Error in playNativeUri", e);
        }
    }

    private void pauseNativePlayback() {
        Log.d(TAG, "pauseNativePlayback");
        if (mediaPlayer != null && mediaPlayer.isPlaying()) {
            try {
                mediaPlayer.pause();
                isPlaying = false;
                stopPanningLoop();
                stopProgressLoop();
                triggerJSEvent("mediaPause");
                updateMediaSessionAndNotification();
            } catch (Exception e) {
                Log.e(TAG, "Error in pauseNativePlayback", e);
            }
        }
    }

    private void resumeNativePlayback() {
        Log.d(TAG, "resumeNativePlayback");
        if (mediaPlayer != null && !mediaPlayer.isPlaying()) {
            try {
                requestAudioFocus();
                mediaPlayer.start();
                isPlaying = true;
                startPanningLoop();
                startProgressLoop();
                triggerJSEvent("mediaPlay");
                updateMediaSessionAndNotification();
            } catch (Exception e) {
                Log.e(TAG, "Error in resumeNativePlayback", e);
            }
        }
    }

    private void seekNativePlayback(double seconds) {
        Log.d(TAG, "seekNativePlayback to: " + seconds);
        if (mediaPlayer != null) {
            try {
                mediaPlayer.seekTo((int) (seconds * 1000));
                currentPosition = seconds;
                updateMediaSessionAndNotification();
            } catch (Exception e) {
                Log.e(TAG, "Error in seekNativePlayback", e);
            }
        }
    }

    private void startPanningLoop() {
        panningHandler.removeCallbacks(panningRunnable);
        panningHandler.post(panningRunnable);
    }

    private void stopPanningLoop() {
        panningHandler.removeCallbacks(panningRunnable);
    }

    private void startProgressLoop() {
        progressHandler.removeCallbacks(progressRunnable);
        progressHandler.post(progressRunnable);
    }

    private void stopProgressLoop() {
        progressHandler.removeCallbacks(progressRunnable);
    }

    private void updatePanning() {
        if (mediaPlayer != null && isPlaying) {
            double dt = 0.02; // 20ms
            panningAngle += rotationSpeed * dt * Math.PI * 2;
            panningAngle %= (Math.PI * 2);

            double pan = Math.sin(panningAngle);
            float leftVolume = (float) ((1.0 - pan) * 0.5 * masterVolume);
            float rightVolume = (float) ((1.0 + pan) * 0.5 * masterVolume);
            try {
                mediaPlayer.setVolume(leftVolume, rightVolume);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }

    private void updateProgress() {
        if (mediaPlayer != null && isPlaying) {
            try {
                double currentPos = mediaPlayer.getCurrentPosition() / 1000.0;
                double duration = mediaPlayer.getDuration() / 1000.0;
                currentPosition = currentPos;
                currentDuration = duration;

                updateMediaSessionPlaybackState();
                updateNotificationProgressOnly();
                
                // Dispatch nativeTimeUpdate progress callback to Javascript
                MainActivity activity = MainActivity.getInstance();
                if (activity != null && activity.getBridge() != null && activity.getBridge().getWebView() != null) {
                    activity.getBridge().getWebView().post(new Runnable() {
                        @Override
                        public void run() {
                            activity.getBridge().getWebView().evaluateJavascript(
                                "window.dispatchEvent(new CustomEvent('nativeTimeUpdate', { detail: { currentTime: " + currentPos + ", duration: " + duration + " } }));", null
                            );
                        }
                    });
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }

    private void updateNotificationProgressOnly() {
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify(NOTIFICATION_ID, buildMediaNotification());
        }
    }

    private void updateMediaSessionPlaybackState() {
        if (mediaSession == null) return;
        int state = isPlaying ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED;
        PlaybackStateCompat.Builder stateBuilder = new PlaybackStateCompat.Builder()
            .setActions(
                PlaybackStateCompat.ACTION_PLAY |
                PlaybackStateCompat.ACTION_PAUSE |
                PlaybackStateCompat.ACTION_PLAY_PAUSE |
                PlaybackStateCompat.ACTION_SKIP_TO_NEXT |
                PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS |
                PlaybackStateCompat.ACTION_SEEK_TO
            )
            .setState(state, (long) (currentPosition * 1000), isPlaying ? 1.0f : 0.0f);
        mediaSession.setPlaybackState(stateBuilder.build());
    }

    private void requestAudioFocus() {
        if (!hasAudioFocus && audioManager != null) {
            Log.d(TAG, "requestAudioFocus");
            try {
                int result;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    audioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                        .setAudioAttributes(new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_MEDIA)
                            .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                            .build())
                        .setAcceptsDelayedFocusGain(true)
                        .setOnAudioFocusChangeListener(audioFocusChangeListener)
                        .build();
                    result = audioManager.requestAudioFocus(audioFocusRequest);
                } else {
                    result = audioManager.requestAudioFocus(audioFocusChangeListener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN);
                }
                if (result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
                    hasAudioFocus = true;
                    Log.d(TAG, "Audio focus request granted");
                } else {
                    Log.w(TAG, "Audio focus request failed: " + result);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error requesting audio focus", e);
            }
        }
    }

    private void abandonAudioFocus() {
        if (hasAudioFocus && audioManager != null) {
            Log.d(TAG, "abandonAudioFocus");
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
                    audioManager.abandonAudioFocusRequest(audioFocusRequest);
                } else {
                    audioManager.abandonAudioFocus(audioFocusChangeListener);
                }
                hasAudioFocus = false;
            } catch (Exception e) {
                Log.e(TAG, "Error abandoning audio focus", e);
            }
        }
    }

    private void releaseMediaPlayer() {
        if (mediaPlayer != null) {
            Log.d(TAG, "releaseMediaPlayer");
            try {
                mediaPlayer.stop();
                mediaPlayer.release();
            } catch (Exception e) {
                Log.e(TAG, "Error releasing MediaPlayer", e);
            }
            mediaPlayer = null;
        }
    }

    private void updateMediaSessionAndNotification() {
        if (mediaSession == null) return;
        Log.d(TAG, "updateMediaSessionAndNotification");

        // Update Media Metadata with valid duration long value
        MediaMetadataCompat.Builder metadataBuilder = new MediaMetadataCompat.Builder()
            .putString(MediaMetadataCompat.METADATA_KEY_TITLE, currentTitle)
            .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, currentArtist)
            .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, (long) (currentDuration * 1000));

        if (currentArtworkBitmap != null) {
            metadataBuilder.putBitmap(MediaMetadataCompat.METADATA_KEY_ALBUM_ART, currentArtworkBitmap);
        }
        mediaSession.setMetadata(metadataBuilder.build());

        // Update Playback State
        updateMediaSessionPlaybackState();

        // Update the active Foreground Notification
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify(NOTIFICATION_ID, buildMediaNotification());
        }
    }

    private Notification buildMediaNotification() {
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            0,
            notificationIntent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        // Define custom layouts inside RemoteViews
        RemoteViews collapsedView = new RemoteViews(getPackageName(), R.layout.custom_media_notification);

        // Update titles and artist text
        collapsedView.setTextViewText(R.id.notification_title, currentTitle);
        collapsedView.setTextViewText(R.id.notification_artist, currentArtist);

        if (currentArtworkBitmap != null) {
            collapsedView.setImageViewBitmap(R.id.notification_artwork, currentArtworkBitmap);
        } else {
            collapsedView.setImageViewResource(R.id.notification_artwork, R.mipmap.ic_launcher);
        }

        // Set Play/Pause icon (ensure pause icon is ||, play icon is >)
        int playPauseIcon = isPlaying ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play;
        collapsedView.setImageViewResource(R.id.notification_play_pause, playPauseIcon);

        // Set Repeat icon and color/alpha state based on isRepeat
        collapsedView.setImageViewResource(R.id.notification_repeat, android.R.drawable.ic_popup_sync);
        if (isRepeat) {
            // Apply green color filter when active
            collapsedView.setInt(R.id.notification_repeat, "setColorFilter", 0xFF00FF00);
        } else {
            // Reset to default white when inactive
            collapsedView.setInt(R.id.notification_repeat, "setColorFilter", 0xFFFFFFFF);
        }

        // Update progress bar
        int progressPercent = (currentDuration > 0) ? (int) ((currentPosition / currentDuration) * 100) : 0;
        collapsedView.setProgressBar(R.id.notification_progress, 100, progressPercent, false);

        // Define Actions PendingIntents
        PendingIntent playPausePending = getPendingIntentForAction(isPlaying ? "PAUSE" : "PLAY");
        PendingIntent nextPending = getPendingIntentForAction("NEXT");
        PendingIntent prevPending = getPendingIntentForAction("PREV");
        PendingIntent repeatPending = getPendingIntentForAction("REPEAT");

        collapsedView.setOnClickPendingIntent(R.id.notification_prev, prevPending);
        collapsedView.setOnClickPendingIntent(R.id.notification_play_pause, playPausePending);
        collapsedView.setOnClickPendingIntent(R.id.notification_next, nextPending);
        collapsedView.setOnClickPendingIntent(R.id.notification_repeat, repeatPending);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pendingIntent)
            .setCustomContentView(collapsedView)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setOngoing(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC);

        return builder.build();
    }

    private String formatTime(double seconds) {
        if (Double.isNaN(seconds) || Double.isInfinite(seconds) || seconds < 0) {
            return "00:00";
        }
        int totalSeconds = (int) Math.round(seconds);
        int mins = totalSeconds / 60;
        int secs = totalSeconds % 60;
        return String.format("%02d:%02d", mins, secs);
    }

    private PendingIntent getPendingIntentForAction(String actionName) {
        Intent intent = new Intent(this, NotificationActionReceiver.class);
        intent.setAction(actionName);
        return PendingIntent.getBroadcast(
            this,
            actionName.hashCode(),
            intent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );
    }

    private void downloadArtwork(final String urlString) {
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    URL url = new URL(urlString);
                    HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                    connection.setDoInput(true);
                    connection.connect();
                    InputStream input = connection.getInputStream();
                    currentArtworkBitmap = BitmapFactory.decodeStream(input);
                    Log.d(TAG, "Artwork downloaded successfully");
                    updateMediaSessionAndNotification();
                } catch (Exception e) {
                    Log.e(TAG, "Artwork download failed", e);
                    currentArtworkBitmap = null;
                    updateMediaSessionAndNotification();
                }
            }
        }).start();
    }

    @Override
    public void onDestroy() {
        Log.d(TAG, "MediaPlaybackService onDestroy");
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        if (wifiLock != null && wifiLock.isHeld()) {
            wifiLock.release();
        }
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
        }
        stopPanningLoop();
        stopProgressLoop();
        releaseMediaPlayer();
        abandonAudioFocus();
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
