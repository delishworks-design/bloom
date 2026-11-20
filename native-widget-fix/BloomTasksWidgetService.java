package com.delishworks.bloom;

import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONArray;
import org.json.JSONObject;

/* JADX INFO: loaded from: classes.dex */
public class BloomTasksWidgetService extends RemoteViewsService {
    @Override // android.widget.RemoteViewsService
    public RemoteViewsService.RemoteViewsFactory onGetViewFactory(Intent intent) {
        Context applicationContext = getApplicationContext();
        if (intent == null) {
            intent = new Intent();
        }
        return new TaskFactory(applicationContext, intent);
    }

    static class TaskFactory implements RemoteViewsService.RemoteViewsFactory {
        private final int appWidgetId;
        private final Context ctx;
        private final List<JSONObject> items = new ArrayList();
        private final List<Bitmap> rowBitmaps = new ArrayList();

        @Override // android.widget.RemoteViewsService.RemoteViewsFactory
        public long getItemId(int i) {
            return i;
        }

        @Override // android.widget.RemoteViewsService.RemoteViewsFactory
        public RemoteViews getLoadingView() {
            RemoteViews rv = new RemoteViews(this.ctx.getPackageName(), R.layout.bloom_widget_task_item);
            Bitmap blank = Bitmap.createBitmap(1, 1, Bitmap.Config.ARGB_8888);
            blank.eraseColor(Color.TRANSPARENT);
            rv.setImageViewBitmap(R.id.taskRow, blank);
            return rv;
        }

        @Override // android.widget.RemoteViewsService.RemoteViewsFactory
        public int getViewTypeCount() {
            return 1;
        }

        @Override // android.widget.RemoteViewsService.RemoteViewsFactory
        public boolean hasStableIds() {
            return true;
        }

        @Override // android.widget.RemoteViewsService.RemoteViewsFactory
        public void onCreate() {
        }

        TaskFactory(Context context, Intent intent) {
            this.ctx = context;
            this.appWidgetId = intent.getIntExtra("appWidgetId", 0);
        }

        @Override // android.widget.RemoteViewsService.RemoteViewsFactory
        public void onDataSetChanged() {
            this.items.clear();
            this.rowBitmaps.clear();
            JSONArray jSONArrayOptJSONArray = BloomWidgetStore.snapshot(this.ctx).optJSONArray("tasks");
            if (jSONArrayOptJSONArray == null) {
                return;
            }
            int width = BloomWidgetPaint.maxWidthPx(this.ctx, this.appWidgetId);
            for (int i = 0; i < jSONArrayOptJSONArray.length() && i < 100; i++) {
                JSONObject jSONObjectOptJSONObject = jSONArrayOptJSONArray.optJSONObject(i);
                if (jSONObjectOptJSONObject != null) {
                    this.items.add(jSONObjectOptJSONObject);
                    this.rowBitmaps.add(BloomWidgetPaint.taskRow(this.ctx,
                        jSONObjectOptJSONObject.optString("t", ""),
                        jSONObjectOptJSONObject.optBoolean("done", false), width));
                }
            }
        }

        @Override // android.widget.RemoteViewsService.RemoteViewsFactory
        public void onDestroy() {
            this.items.clear();
            this.rowBitmaps.clear();
        }

        @Override // android.widget.RemoteViewsService.RemoteViewsFactory
        public int getCount() {
            return this.items.size();
        }

        @Override // android.widget.RemoteViewsService.RemoteViewsFactory
        public RemoteViews getViewAt(int i) {
            if (i < 0 || i >= this.items.size()) {
                return null;
            }
            JSONObject jSONObject = this.items.get(i);
            boolean zOptBoolean = jSONObject.optBoolean("done", false);
            String strOptString = jSONObject.optString("t", "");
            Bitmap bitmapTaskRow = i < this.rowBitmaps.size() ? this.rowBitmaps.get(i) : null;
            if (bitmapTaskRow == null) {
                bitmapTaskRow = BloomWidgetPaint.taskRow(this.ctx, strOptString, zOptBoolean, BloomWidgetPaint.maxWidthPx(this.ctx, this.appWidgetId));
            }
            RemoteViews remoteViews = new RemoteViews(this.ctx.getPackageName(), R.layout.bloom_widget_task_item);
            remoteViews.setImageViewBitmap(R.id.taskRow, bitmapTaskRow);
            remoteViews.setContentDescription(R.id.taskRow, strOptString);
            Intent intent = new Intent();
            intent.putExtra("taskId", jSONObject.optString("id", ""));
            intent.putExtra("done", !zOptBoolean);
            remoteViews.setOnClickFillInIntent(R.id.taskRow, intent);
            return remoteViews;
        }
    }
}
