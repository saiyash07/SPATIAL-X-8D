package com.saiyash.spatialx8d;

import android.content.Context;
import android.util.AttributeSet;
import android.view.View;
import com.getcapacitor.CapacitorWebView;

public class BackgroundWebView extends CapacitorWebView {

    public BackgroundWebView(Context context, AttributeSet attrs) {
        super(context, attrs);
    }

    @Override
    protected void onWindowVisibilityChanged(int visibility) {
        // Force WebView to believe it is always VISIBLE. This keeps the JS engine
        // and WebAudio rendering thread active when app is backgrounded or screen off.
        super.onWindowVisibilityChanged(View.VISIBLE);
    }

    @Override
    public void onWindowFocusChanged(boolean hasWindowFocus) {
        // Keep focus state to prevent audio focus loss triggers
        super.onWindowFocusChanged(true);
    }

    @Override
    protected void onVisibilityChanged(View changedView, int visibility) {
        // Prevent layout visibility state changes from pausing playback
        super.onVisibilityChanged(changedView, View.VISIBLE);
    }
}
