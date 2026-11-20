package com.delishworks.bloom;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.widget.RemoteViews;
import org.json.JSONObject;

/* JADX INFO: loaded from: classes.dex */
public class BloomWaterMoodWidgetProvider extends AppWidgetProvider {
    static final String ACTION_MOOD = "com.delishworks.bloom.WIDGET_MOOD";
    static final String ACTION_WATER = "com.delishworks.bloom.WIDGET_WATER";
    static final String EXTRA_MOOD = "mood";
    private static final int[] GLASS = {R.id.glass0, R.id.glass1, R.id.glass2, R.id.glass3, R.id.glass4, R.id.glass5, R.id.glass6, R.id.glass7};
    private static final int[] MOOD = {R.id.mood1, R.id.mood2, R.id.mood3, R.id.mood4, R.id.mood5};
    private static final int[] FACE_OFF = {R.drawable.face_1_off, R.drawable.face_2_off, R.drawable.face_3_off, R.drawable.face_4_off, R.drawable.face_5_off};
    private static final int[] FACE_ON = {R.drawable.face_1_on, R.drawable.face_2_on, R.drawable.face_3_on, R.drawable.face_4_on, R.drawable.face_5_on};

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
        int intExtra;
        super.onReceive(context, intent);
        String action = intent.getAction();
        if (action == null) {
            return;
        }
        AppWidgetManager appWidgetManager = AppWidgetManager.getInstance(context);
        try {
            JSONObject jSONObjectSnapshot = BloomWidgetStore.snapshot(context);
            JSONObject jSONObject = new JSONObject();
            if (ACTION_WATER.equals(action)) {
                jSONObjectSnapshot.put("water", Math.max(0, jSONObjectSnapshot.optInt("water", 0) + 1));
                jSONObject.put("type", "water");
                jSONObject.put("v", 1);
            } else {
                if (ACTION_MOOD.equals(action) && (intExtra = intent.getIntExtra(EXTRA_MOOD, 0)) >= 1 && intExtra <= 5) {
                    jSONObjectSnapshot.put(EXTRA_MOOD, intExtra);
                    jSONObject.put("type", EXTRA_MOOD);
                    jSONObject.put("v", intExtra);
                }
                return;
            }
            BloomWidgetStore.saveSnapshot(context, jSONObjectSnapshot);
            BloomWidgetStore.queueAction(context, jSONObject);
        } catch (Exception unused) {
        }
        int[] appWidgetIds = appWidgetManager.getAppWidgetIds(new ComponentName(context, (Class<?>) BloomWaterMoodWidgetProvider.class));
        if (appWidgetIds == null || appWidgetIds.length <= 0) {
            return;
        }
        render(context, appWidgetManager, appWidgetIds);
    }

    /* JADX WARN: Removed duplicated region for block: B:42:0x0148  */
    /* JADX WARN: Removed duplicated region for block: B:47:0x01cd  */
    /*
        Code decompiled incorrectly, please refer to instructions dump.
    */
    static void render(Context context, AppWidgetManager appWidgetManager, int[] iArr) {
        String str;
        int i;
        int iOptInt;
        String str2;
        int i2;
        Long l;
        RemoteViews remoteViews;
        String str3;
        String str4;
        JSONObject jSONObject;
        int i3;
        boolean z;
        int i4;
        String str5;
        String str6;
        int i5;
        Long lValueOf;
        String strOptString;
        Context context2 = context;
        int[] iArr2 = iArr;
        String str7 = "daysToPeriod";
        String str8 = "";
        JSONObject jSONObjectSnapshot = BloomWidgetStore.snapshot(context);
        int i6 = 0;
        int iMax = Math.max(0, jSONObjectSnapshot.optInt("water", 0));
        int iGoal = jSONObjectSnapshot.optInt("goal", 8);
        if (iGoal <= 0) iGoal = 8;
        int iOptInt2 = jSONObjectSnapshot.optInt(EXTRA_MOOD, 0);
        boolean zOptBoolean = jSONObjectSnapshot.optBoolean("hasToday", true);
        int length = iArr2.length;
        int i7 = 0;
        while (i7 < length) {
            int i8 = iArr2[i7];
            RemoteViews remoteViews2 = new RemoteViews(context.getPackageName(), R.layout.bloom_widget_water);
            remoteViews2.setOnClickPendingIntent(R.id.waterKicker, BloomWidgetStore.openApp(context2, 5300));
            int i9 = i6;
            while (i9 < 8) {
                remoteViews2.setImageViewResource(GLASS[i9], i9 < iMax ? R.drawable.glass_on : R.drawable.glass_off);
                i9++;
            }
            int i10 = i7;
            remoteViews2.setImageViewBitmap(R.id.waterKicker, BloomWidgetPaint.kicker(context2, "WATER", 16.0f, -7570816));
            remoteViews2.setImageViewBitmap(R.id.waterCount, BloomWidgetPaint.count(context2, iMax + " of " + iGoal, 15.0f, -7570816));
            remoteViews2.setImageViewBitmap(R.id.addGlass, BloomWidgetPaint.pill(context2, "+1 glass"));
            int i11 = length;
            remoteViews2.setOnClickPendingIntent(R.id.addGlass, BloomWidgetStore.broadcast(context2, BloomWaterMoodWidgetProvider.class, ACTION_WATER, 5400, null));
            remoteViews2.setImageViewBitmap(R.id.moodKicker, BloomWidgetPaint.kicker(context2, "MOOD", 16.0f, -7570816));
            int i12 = 0;
            while (i12 < 5) {
                int[] iArr3 = MOOD;
                int i13 = i12 + 1;
                remoteViews2.setImageViewResource(iArr3[i12], iOptInt2 == i13 ? FACE_ON[i12] : FACE_OFF[i12]);
                Intent intent = new Intent();
                intent.putExtra(EXTRA_MOOD, i13);
                remoteViews2.setOnClickPendingIntent(iArr3[i12], BloomWidgetStore.broadcast(context2, BloomWaterMoodWidgetProvider.class, ACTION_MOOD, i12 + 5500, intent));
                i12 = i13;
            }
            if (!zOptBoolean) {
                remoteViews2.setImageViewBitmap(R.id.waterCount, BloomWidgetPaint.meta(context2, "No log today", 16.0f, -7570816));
            }
            try {
                JSONObject jSONObjectOptJSONObject = jSONObjectSnapshot.optJSONObject("cycle");
                if (jSONObjectOptJSONObject != null) {
                    int iOptInt3 = jSONObjectOptJSONObject.optInt("day", 0);
                    try {
                        iOptInt = jSONObjectOptJSONObject.optInt("length", 0);
                        try {
                            strOptString = jSONObjectOptJSONObject.optString("phaseLabel", str8);
                        } catch (Exception unused) {
                            i = iOptInt3;
                            str = str8;
                        }
                        try {
                            if (jSONObjectOptJSONObject.isNull(str7)) {
                                str6 = strOptString;
                                lValueOf = null;
                            } else {
                                lValueOf = Long.valueOf(jSONObjectOptJSONObject.optLong(str7));
                                str6 = strOptString;
                            }
                            i5 = iOptInt3;
                        } catch (Exception unused2) {
                            str = strOptString;
                            i = iOptInt3;
                            str2 = str;
                            i2 = i;
                            l = null;
                        }
                    } catch (Exception unused3) {
                        i = iOptInt3;
                        str = str8;
                        iOptInt = 0;
                        str2 = str;
                        i2 = i;
                        l = null;
                        if (i2 <= 0) {
                        }
                        appWidgetManager.updateAppWidget(i4, remoteViews);
                        i7 = i10 + 1;
                        context2 = context;
                        iArr2 = iArr;
                        i6 = i3;
                        str7 = str3;
                        str8 = str4;
                        length = i11;
                        jSONObjectSnapshot = jSONObject;
                    }
                } else {
                    str6 = str8;
                    i5 = 0;
                    iOptInt = 0;
                    lValueOf = null;
                }
                str2 = str6;
                i2 = i5;
                l = lValueOf;
            } catch (Exception unused4) {
                str = str8;
                i = 0;
            }
            if (i2 <= 0) {
                int iMax2 = Math.max(1, Math.round(BloomWidgetPaint.dp(context2, appWidgetManager.getAppWidgetOptions(i8).getInt("appWidgetMaxWidth", 250))) - Math.round(BloomWidgetPaint.dp(context2, 28.0f)));
                remoteViews = remoteViews2;
                str3 = str7;
                str4 = str8;
                i4 = i8;
                int i14 = iOptInt;
                Long l2 = l;
                jSONObject = jSONObjectSnapshot;
                z = true;
                remoteViews.setImageViewBitmap(R.id.cycleRow, BloomWidgetPaint.cycleRowBit(context, i2, i14, str2, l2, iMax2));
                i3 = 0;
                remoteViews.setViewVisibility(R.id.cycleRow, 0);
                int i15 = R.id.cycleRow;
                StringBuilder sb = new StringBuilder("Day ");
                sb.append(i2);
                sb.append(" ");
                sb.append(str2);
                if (l2 == null) {
                    str5 = str4;
                } else {
                    str5 = ", next period in " + l2 + " days";
                }
                sb.append(str5);
                remoteViews.setContentDescription(i15, sb.toString());
            } else {
                remoteViews = remoteViews2;
                str3 = str7;
                str4 = str8;
                jSONObject = jSONObjectSnapshot;
                i3 = 0;
                z = true;
                i4 = i8;
                remoteViews.setViewVisibility(R.id.cycleRow, 8);
            }
            appWidgetManager.updateAppWidget(i4, remoteViews);
            i7 = i10 + 1;
            context2 = context;
            iArr2 = iArr;
            i6 = i3;
            str7 = str3;
            str8 = str4;
            length = i11;
            jSONObjectSnapshot = jSONObject;
        }
    }
}
