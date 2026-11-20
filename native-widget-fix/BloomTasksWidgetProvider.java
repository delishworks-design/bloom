package com.delishworks.bloom;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

/* JADX INFO: loaded from: classes.dex */
public class BloomTasksWidgetProvider extends AppWidgetProvider {
    static final String ACTION_TASK = "com.delishworks.bloom.WIDGET_TASK";
    static final String EXTRA_DONE = "done";
    static final String EXTRA_ID = "taskId";

    @Override // android.appwidget.AppWidgetProvider
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] iArr) {
        render(context, appWidgetManager, iArr);
    }

    @Override // android.appwidget.AppWidgetProvider
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager appWidgetManager, int i, Bundle bundle) {
        render(context, appWidgetManager, new int[]{i});
    }

    @Override // android.appwidget.AppWidgetProvider, android.content.BroadcastReceiver
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent.getAction();
        if (action == null || !ACTION_TASK.equals(action)) {
            return;
        }
        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        String stringExtra = intent.getStringExtra(EXTRA_ID);
        boolean booleanExtra = intent.getBooleanExtra(EXTRA_DONE, true);
        try {
            JSONObject jSONObjectSnapshot = BloomWidgetStore.snapshot(context);
            JSONArray jSONArrayOptJSONArray = jSONObjectSnapshot.optJSONArray("tasks");
            if (jSONArrayOptJSONArray != null) {
                int i = 0;
                while (true) {
                    if (i < jSONArrayOptJSONArray.length()) {
                        JSONObject jSONObjectOptJSONObject = jSONArrayOptJSONArray.optJSONObject(i);
                        if (jSONObjectOptJSONObject != null && stringExtra != null && stringExtra.equals(jSONObjectOptJSONObject.optString("id"))) {
                            jSONObjectOptJSONObject.put(EXTRA_DONE, booleanExtra);
                            break;
                        }
                        i++;
                    } else {
                        break;
                    }
                }
                jSONObjectSnapshot.put("tasks", jSONArrayOptJSONArray);
                BloomWidgetStore.saveSnapshot(context, jSONObjectSnapshot);
            }
            JSONObject jSONObject = new JSONObject();
            jSONObject.put("type", "task");
            if (stringExtra == null) {
                stringExtra = "";
            }
            jSONObject.put("v", stringExtra);
            jSONObject.put(EXTRA_DONE, booleanExtra);
            BloomWidgetStore.queueAction(context, jSONObject);
        } catch (Exception unused) {
        }
        int[] appWidgetIds = appWidgetManager.getAppWidgetIds(new ComponentName(context, (Class<?>) BloomTasksWidgetProvider.class));
        if (appWidgetIds == null || appWidgetIds.length <= 0) {
            return;
        }
        render(context, appWidgetManager, appWidgetIds);
    }

    static String countText(Context context) {
        JSONArray jSONArrayOptJSONArray = BloomWidgetStore.snapshot(context).optJSONArray("tasks");
        if (jSONArrayOptJSONArray == null || jSONArrayOptJSONArray.length() == 0) {
            return "No tasks today";
        }
        int iMin = Math.min(100, jSONArrayOptJSONArray.length());
        int i = 0;
        for (int i2 = 0; i2 < iMin; i2++) {
            JSONObject jSONObjectOptJSONObject = jSONArrayOptJSONArray.optJSONObject(i2);
            if (jSONObjectOptJSONObject != null && jSONObjectOptJSONObject.optBoolean(EXTRA_DONE, false)) {
                i++;
            }
        }
        return i + " of " + iMin + " done";
    }

    static void render(Context context, AppWidgetManager appWidgetManager, int[] iArr) {
        JSONArray jSONArrayOptJSONArray;
        for (int i : iArr) {
            RemoteViews remoteViews = new RemoteViews(context.getPackageName(), R.layout.bloom_widget_tasks);
            remoteViews.setOnClickPendingIntent(R.id.tasksKicker, BloomWidgetStore.openApp(context, 5100));
            remoteViews.setImageViewBitmap(R.id.tasksKicker, BloomWidgetPaint.kicker(context, "TODAY", 18.0f, -7570816));
            try {
                jSONArrayOptJSONArray = BloomWidgetStore.snapshot(context).optJSONArray("tasks");
            } catch (Exception unused) {
            }
            boolean z = jSONArrayOptJSONArray != null && jSONArrayOptJSONArray.length() > 0;
            remoteViews.setViewVisibility(R.id.taskCount, z ? 0 : 8);
            if (z) {
                remoteViews.setImageViewBitmap(R.id.taskCount, BloomWidgetPaint.count(context, countText(context), 22.0f, -7570816));
            }
            remoteViews.setImageViewBitmap(android.R.id.empty, BloomWidgetPaint.meta(context, "No tasks today", 17.0f, -7570816));
            Intent intent = new Intent(context, (Class<?>) BloomTasksWidgetService.class);
            intent.putExtra("appWidgetId", i);
            intent.setData(Uri.parse(intent.toUri(1)));
            remoteViews.setRemoteAdapter(android.R.id.list, intent);
            remoteViews.setEmptyView(android.R.id.list, android.R.id.empty);
            Intent intent2 = new Intent(context, (Class<?>) BloomTasksWidgetProvider.class);
            intent2.setAction(ACTION_TASK);
            intent2.putExtra("appWidgetId", i);
            remoteViews.setPendingIntentTemplate(android.R.id.list, PendingIntent.getBroadcast(context, 5000, intent2, Build.VERSION.SDK_INT >= 31 ? 167772160 : 134217728));
            appWidgetManager.updateAppWidget(i, remoteViews);
            appWidgetManager.notifyAppWidgetViewDataChanged(i, android.R.id.list);
        }
    }
}
