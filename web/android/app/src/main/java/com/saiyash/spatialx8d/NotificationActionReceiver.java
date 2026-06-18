package com.saiyash.spatialx8d;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class NotificationActionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;

        String action = intent.getAction();
        
        // Control Service directly to ensure background reliability
        Intent serviceIntent = new Intent(context, MediaPlaybackService.class);
        if ("PLAY".equals(action)) {
            serviceIntent.setAction("RESUME_URI");
            context.startService(serviceIntent);
        } else if ("PAUSE".equals(action)) {
            serviceIntent.setAction("PAUSE_URI");
            context.startService(serviceIntent);
        } else if ("NEXT".equals(action)) {
            serviceIntent.setAction("NEXT_TRACK");
            context.startService(serviceIntent);
        } else if ("PREV".equals(action)) {
            serviceIntent.setAction("PREV_TRACK");
            context.startService(serviceIntent);
        } else if ("REPEAT".equals(action)) {
            serviceIntent.setAction("TOGGLE_REPEAT_URI");
            context.startService(serviceIntent);
        }

        // Also attempt to notify WebView in case it is active
        MainActivity activity = MainActivity.getInstance();
        if (activity != null && activity.getBridge() != null && activity.getBridge().getWebView() != null) {
            final String eventName;
            if ("PLAY".equals(action) || "PAUSE".equals(action)) {
                eventName = "mediaPlayPause";
            } else if ("NEXT".equals(action)) {
                eventName = "mediaNext";
            } else if ("PREV".equals(action)) {
                eventName = "mediaPrev";
            } else {
                return;
            }

            activity.getBridge().getWebView().post(new Runnable() {
                @Override
                public void run() {
                    activity.getBridge().getWebView().evaluateJavascript(
                        "window.dispatchEvent(new CustomEvent('" + eventName + "'));", null
                    );
                }
            });
        }
    }
}
