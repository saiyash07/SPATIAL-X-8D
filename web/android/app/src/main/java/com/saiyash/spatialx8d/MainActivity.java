package com.saiyash.spatialx8d;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static MainActivity instance;

    public static MainActivity getInstance() {
        return instance;
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        try {
            super.onCreate(savedInstanceState);
            instance = this;

            // Request POST_NOTIFICATIONS permission programmatically on Android 13+
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 101);
                }
            }
            
            // Configure WebView settings to allow cross-origin requests (CORS bypass for Web Audio API)
            if (bridge != null && bridge.getWebView() != null) {
                android.webkit.WebSettings settings = bridge.getWebView().getSettings();
                settings.setAllowUniversalAccessFromFileURLs(true);
                settings.setAllowFileAccessFromFileURLs(true);
                settings.setMediaPlaybackRequiresUserGesture(false);

                // Inject Javascript Interface for MediaSession synchronization
                bridge.getWebView().addJavascriptInterface(new Object() {
                    private void sendToService(Intent intent) {
                        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                            startForegroundService(intent);
                        } else {
                            startService(intent);
                        }
                    }

                    @JavascriptInterface
                    public boolean isCapacitorActive() {
                        return true;
                    }

                    @JavascriptInterface
                    public void playUri(final String url, final String title, final String artist, final String artworkUrl, final double duration) {
                        Intent intent = new Intent(MainActivity.this, MediaPlaybackService.class);
                        intent.setAction("PLAY_URI");
                        intent.putExtra("url", url);
                        intent.putExtra("title", title);
                        intent.putExtra("artist", artist);
                        intent.putExtra("artwork", artworkUrl);
                        intent.putExtra("duration", duration);
                        sendToService(intent);
                    }

                    @JavascriptInterface
                    public void pauseUri() {
                        Intent intent = new Intent(MainActivity.this, MediaPlaybackService.class);
                        intent.setAction("PAUSE_URI");
                        sendToService(intent);
                    }

                    @JavascriptInterface
                    public void resumeUri() {
                        Intent intent = new Intent(MainActivity.this, MediaPlaybackService.class);
                        intent.setAction("RESUME_URI");
                        sendToService(intent);
                    }

                    @JavascriptInterface
                    public void seekUri(final double positionSeconds) {
                        Intent intent = new Intent(MainActivity.this, MediaPlaybackService.class);
                        intent.setAction("SEEK_URI");
                        intent.putExtra("position", positionSeconds);
                        sendToService(intent);
                    }

                    @JavascriptInterface
                    public void setVolumeUri(final float volume) {
                        Intent intent = new Intent(MainActivity.this, MediaPlaybackService.class);
                        intent.setAction("SET_VOLUME_URI");
                        intent.putExtra("volume", volume);
                        sendToService(intent);
                    }

                    @JavascriptInterface
                    public void setRotationSpeedUri(final float speed) {
                        Intent intent = new Intent(MainActivity.this, MediaPlaybackService.class);
                        intent.setAction("SET_ROTATION_SPEED_URI");
                        intent.putExtra("speed", speed);
                        sendToService(intent);
                    }

                    @JavascriptInterface
                    public void setRepeatUri(final boolean repeat) {
                        Intent intent = new Intent(MainActivity.this, MediaPlaybackService.class);
                        intent.setAction("SET_REPEAT_URI");
                        intent.putExtra("repeat", repeat);
                        sendToService(intent);
                    }

                    @JavascriptInterface
                    public void startPlaybackService() {
                        Intent intent = new Intent(MainActivity.this, MediaPlaybackService.class);
                        sendToService(intent);
                    }

                    @JavascriptInterface
                    public void stopPlaybackService() {
                        Intent intent = new Intent(MainActivity.this, MediaPlaybackService.class);
                        stopService(intent);
                    }

                    @JavascriptInterface
                    public void updateMetadata(final String title, final String artist, final String artworkUrl, final double duration) {
                        Intent intent = new Intent(MainActivity.this, MediaPlaybackService.class);
                        intent.setAction("UPDATE_METADATA");
                        intent.putExtra("title", title);
                        intent.putExtra("artist", artist);
                        intent.putExtra("artwork", artworkUrl);
                        intent.putExtra("duration", duration);
                        sendToService(intent);
                    }

                    @JavascriptInterface
                    public void updatePlaybackState(final boolean playing, final double position) {
                        Intent intent = new Intent(MainActivity.this, MediaPlaybackService.class);
                        intent.setAction("UPDATE_STATE");
                        intent.putExtra("playing", playing);
                        intent.putExtra("position", position);
                        sendToService(intent);
                    }
                }, "AndroidMediaSession");
            }
        } catch (Throwable t) {
            android.util.Log.e("SpatialX8D", "Crash in MainActivity.onCreate", t);
            try {
                java.io.File file = new java.io.File(getExternalFilesDir(null), "crash_log.txt");
                java.io.FileWriter writer = new java.io.FileWriter(file, true);
                writer.write("Crash at: " + new java.util.Date().toString() + "\n");
                writer.write(android.util.Log.getStackTraceString(t) + "\n\n");
                writer.close();
            } catch (Exception ex) {
                ex.printStackTrace();
            }
        }
    }

    @Override
    public void onResume() {
        super.onResume();
        Intent intent = new Intent(this, MediaPlaybackService.class);
        intent.setAction("SET_BACKGROUND");
        intent.putExtra("background", false);
        startService(intent);
    }

    @Override
    public void onPause() {
        com.getcapacitor.Bridge tempBridge = this.bridge;
        this.bridge = null;
        super.onPause();
        this.bridge = tempBridge;
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().onResume();
            this.bridge.getWebView().resumeTimers();
        }
        Intent intent = new Intent(this, MediaPlaybackService.class);
        intent.setAction("SET_BACKGROUND");
        intent.putExtra("background", true);
        startService(intent);
    }

    @Override
    public void onStop() {
        com.getcapacitor.Bridge tempBridge = this.bridge;
        this.bridge = null;
        super.onStop();
        this.bridge = tempBridge;
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().onResume();
            this.bridge.getWebView().resumeTimers();
        }
    }
}

