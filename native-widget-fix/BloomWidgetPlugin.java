package com.delishworks.bloom;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import com.facebook.share.internal.ShareConstants;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import okhttp3.HttpUrl;
import org.json.JSONObject;

/* JADX INFO: loaded from: classes.dex */
@CapacitorPlugin(name = "BloomWidget")
public class BloomWidgetPlugin extends Plugin {
    @PluginMethod
    public void sync(PluginCall pluginCall) {
        boolean z;
        String string = pluginCall.getString(ShareConstants.WEB_DIALOG_PARAM_DATA);
        if (string == null) {
            pluginCall.reject("missing data");
            return;
        }
        SharedPreferences sharedPreferencesPrefs = BloomWidgetStore.prefs(getContext());
        String string2 = sharedPreferencesPrefs.getString("snapshot", "");
        sharedPreferencesPrefs.edit().putString("snapshot", string).apply();
        boolean z2 = true;
        try {
            JSONObject jSONObject = new JSONObject(string2);
            JSONObject jSONObject2 = new JSONObject(string);
            boolean zOptBoolean = jSONObject.optBoolean("hasToday", true);
            boolean zOptBoolean2 = jSONObject2.optBoolean("hasToday", true);
            boolean sameDay = String.valueOf(jSONObject.opt("d")).equals(String.valueOf(jSONObject2.opt("d")));
            z = (sameDay && String.valueOf(jSONObject.opt("tasks")).equals(String.valueOf(jSONObject2.opt("tasks"))) && zOptBoolean == zOptBoolean2) ? false : true;
            try {
                if (sameDay && jSONObject.optInt("water", 0) == jSONObject2.optInt("water", 0)) {
                    if (jSONObject.optInt("mood", 0) == jSONObject2.optInt("mood", 0) && zOptBoolean == zOptBoolean2 && jSONObject.optInt("goal", 8) == jSONObject2.optInt("goal", 8)) {
                        z2 = false;
                    }
                }
            } catch (Exception unused) {
            }
        } catch (Exception unused2) {
            z = true;
        }
        refreshAll(getContext(), z, z2);
        pluginCall.resolve();
    }

    @PluginMethod
    public void consumeActions(PluginCall pluginCall) {
        SharedPreferences sharedPreferencesPrefs = BloomWidgetStore.prefs(getContext());
        String str = HttpUrl.PATH_SEGMENT_ENCODE_SET_URI;
        String string = sharedPreferencesPrefs.getString("actions", HttpUrl.PATH_SEGMENT_ENCODE_SET_URI);
        sharedPreferencesPrefs.edit().putString("actions", HttpUrl.PATH_SEGMENT_ENCODE_SET_URI).apply();
        JSObject jSObject = new JSObject();
        if (string != null) {
            str = string;
        }
        jSObject.put("actions", str);
        pluginCall.resolve(jSObject);
    }

    @PluginMethod
    public void reset(PluginCall pluginCall) {
        BloomWidgetStore.prefs(getContext()).edit().putString("snapshot", "{}").putString("actions", HttpUrl.PATH_SEGMENT_ENCODE_SET_URI).apply();
        refreshAll(getContext(), true, true);
        pluginCall.resolve();
    }

    @PluginMethod
    public void isSupported(PluginCall pluginCall) {
        JSObject jSObject = new JSObject();
        jSObject.put("supported", true);
        pluginCall.resolve(jSObject);
    }

    @PluginMethod
    public void requestPin(PluginCall pluginCall) {
        JSObject jSObject = new JSObject();
        jSObject.put("pinned", false);
        if (Build.VERSION.SDK_INT >= 26) {
            try {
                AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(getContext());
                if (appWidgetManager.isRequestPinAppWidgetSupported()) {
                    jSObject.put("pinned", appWidgetManager.requestPinAppWidget(new ComponentName(getContext(), (Class<?>) ("water".equals(pluginCall.getString("widget", "tasks")) ? BloomWaterMoodWidgetProvider.class : BloomTasksWidgetProvider.class)), null, null));
                }
            } catch (Exception unused) {
            }
        }
        pluginCall.resolve(jSObject);
    }

    public static void refreshAll(Context context, boolean z, boolean z2) {
        int[] appWidgetIds;
        int[] appWidgetIds2;
        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        if (z && (appWidgetIds2 = appWidgetManager.getAppWidgetIds(new ComponentName(context, (Class<?>) BloomTasksWidgetProvider.class))) != null && appWidgetIds2.length > 0) {
            BloomTasksWidgetProvider.render(context, appWidgetManager, appWidgetIds2);
        }
        if (!z2 || (appWidgetIds = appWidgetManager.getAppWidgetIds(new ComponentName(context, (Class<?>) BloomWaterMoodWidgetProvider.class))) == null || appWidgetIds.length <= 0) {
            return;
        }
        BloomWaterMoodWidgetProvider.render(context, appWidgetManager, appWidgetIds);
    }
}
