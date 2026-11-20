package com.delishworks.bloom;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.RectF;
import android.graphics.Typeface;
import java.util.ArrayList;
import java.util.List;

/* JADX INFO: loaded from: classes.dex */
final class BloomWidgetPaint {
    static final int CREAM = -1035;
    static final int FADED = -5793892;
    static final int INK = -12964301;
    static final int MUT = -7570816;
    static final int RING = -2701365;
    static final int ROSE = -4700821;
    static final int TEAL = -13989241;
    static final int TEAL_FILL = -1050890;
    static final int TEAL_STROKE = -7552063;
    private static Typeface playfairCached;
    private static Typeface sansBoldCached;
    private static Typeface sansCached;

    private BloomWidgetPaint() {
    }

    static float dp(Context context, float f) {
        return f * context.getResources().getDisplayMetrics().scaledDensity;
    }

    static int maxWidthPx(Context context, int i) {
        return Math.max(1, Math.round(dp(context, AppWidgetManager.getInstance(context).getAppWidgetOptions(i).getInt("appWidgetMaxWidth", 250))) - Math.round(dp(context, 32.0f)));
    }

    static Typeface sans(Context context, boolean z) {
        if (z) {
            if (sansBoldCached == null) {
                try {
                    sansBoldCached = Typeface.createFromAsset(context.getAssets(), "fonts/Sansita-Bold.ttf");
                } catch (Exception unused) {
                    sansBoldCached = Typeface.create("sans-serif", 1);
                }
            }
            return sansBoldCached;
        }
        if (sansCached == null) {
            try {
                sansCached = Typeface.createFromAsset(context.getAssets(), "fonts/Sansita-Regular.ttf");
            } catch (Exception unused2) {
                sansCached = Typeface.create("sans-serif", 0);
            }
        }
        return sansCached;
    }

    static Typeface playfair(Context context) {
        if (playfairCached == null) {
            try {
                playfairCached = Typeface.createFromAsset(context.getAssets(), "fonts/PlayfairDisplay-Bold.ttf");
            } catch (Exception unused) {
                playfairCached = Typeface.create("serif", 1);
            }
        }
        return playfairCached;
    }

    private static Paint base(Typeface typeface, float f, int i, float f2) {
        Paint paint = new Paint(129);
        paint.setTypeface(typeface);
        paint.setTextSize(f);
        paint.setColor(i);
        paint.setLetterSpacing(f2);
        paint.setStyle(Paint.Style.FILL);
        return paint;
    }

    private static Bitmap textBitmap(Paint paint, String str, float f, Context context) {
        if (str == null) {
            str = "";
        }
        float fMeasureText = paint.measureText(str);
        Paint.FontMetrics fontMetrics = paint.getFontMetrics();
        Bitmap bitmapCreateBitmap = Bitmap.createBitmap(Math.max(1, ((int) Math.ceil(fMeasureText)) + 2), Math.max(1, (int) Math.ceil((fontMetrics.bottom - fontMetrics.top) + (2.0f * f))), Bitmap.Config.ARGB_8888);
        new Canvas(bitmapCreateBitmap).drawText(str, 1.0f, f - fontMetrics.top, paint);
        return bitmapCreateBitmap;
    }

    static Bitmap header(Context context, String str, float f, int i) {
        return textBitmap(base(playfair(context), dp(context, f), i, 0.0f), str, dp(context, 2.0f), context);
    }

    static Bitmap kicker(Context context, String str, float f, int i) {
        return textBitmap(base(sans(context, true), dp(context, f), i, 0.06f), str, dp(context, 2.0f), context);
    }

    static Bitmap count(Context context, String str, float f, int i) {
        return textBitmap(base(sans(context, true), dp(context, f), i, 0.06f), str, dp(context, 2.0f), context);
    }

    static Bitmap meta(Context context, String str, float f, int i) {
        return textBitmap(base(sans(context, false), dp(context, f), i, 0.0f), str, dp(context, 3.0f), context);
    }

    static Bitmap cycleRowBit(Context context, int i, int i2, String str, Long l, int i3) {
        String str2;
        String str3;
        Paint paintBase = base(sans(context, false), dp(context, 17.5f), INK, 0.0f);
        Paint paintBase2 = base(sans(context, true), dp(context, 12.0f), MUT, 0.08f);
        Paint paintBase3 = base(sans(context, true), dp(context, 13.5f), ROSE, 0.02f);
        String str4 = "";
        if (str == null) {
            str = "";
        }
        if (i > 0) {
            StringBuilder sb = new StringBuilder("Day ");
            sb.append(i);
            if (i2 > 0) {
                str2 = " of " + i2;
            } else {
                str2 = "";
            }
            sb.append(str2);
            if (str.isEmpty()) {
                str3 = "";
            } else {
                str3 = " · " + str;
            }
            sb.append(str3);
            str = sb.toString();
        }
        if (l != null) {
            if (l.longValue() == 0) {
                str4 = "Period today";
            } else if (l.longValue() == 1) {
                str4 = "Period tomorrow";
            } else {
                str4 = "Period in " + l + " days";
            }
        }
        Paint.FontMetrics fontMetrics = paintBase.getFontMetrics();
        float f = fontMetrics.bottom - fontMetrics.top;
        int iMax = Math.max(1, i3);
        Bitmap bitmapCreateBitmap = Bitmap.createBitmap(Math.max(1, iMax), Math.max(1, (int) (f + dp(context, 6.0f))), Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmapCreateBitmap);
        float height = ((bitmapCreateBitmap.getHeight() + fontMetrics.bottom) / 2.0f) - fontMetrics.bottom;
        float fMeasureText = paintBase2.measureText("CYCLE") + dp(context, 6.0f);
        canvas.drawText("CYCLE", 0.0f, height, paintBase2);
        float f2 = fMeasureText + 0.0f;
        float f3 = iMax;
        canvas.drawText(ellipsize(paintBase, str, Math.max(0.0f, (f3 - f2) - (str4.isEmpty() ? 0.0f : paintBase3.measureText(str4) + dp(context, 10.0f)))), f2, height, paintBase);
        if (!str4.isEmpty()) {
            canvas.drawText(str4, f3 - paintBase3.measureText(str4), height, paintBase3);
        }
        return bitmapCreateBitmap;
    }

    static Bitmap pill(Context context, String str) {
        Paint paintBase = base(sans(context, true), dp(context, 18.0f), TEAL, 0.04f);
        float fMeasureText = paintBase.measureText(str);
        float fDp = dp(context, 15.0f);
        float fDp2 = dp(context, 9.0f);
        dp(context, 999.0f);
        Paint.FontMetrics fontMetrics = paintBase.getFontMetrics();
        float f = (fontMetrics.bottom - fontMetrics.top) + (fDp2 * 2.0f);
        float f2 = fMeasureText + (fDp * 2.0f);
        Bitmap bitmapCreateBitmap = Bitmap.createBitmap(Math.max(1, (int) Math.ceil(f2)), Math.max(1, (int) Math.ceil(f)), Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmapCreateBitmap);
        Paint paint = new Paint(1);
        paint.setStyle(Paint.Style.FILL);
        paint.setColor(TEAL_FILL);
        float f3 = f / 2.0f;
        canvas.drawRoundRect(new RectF(0.0f, 0.0f, f2, f), f3, f3, paint);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(dp(context, 1.4f));
        paint.setColor(TEAL_STROKE);
        canvas.drawRoundRect(new RectF(dp(context, 0.7f), dp(context, 0.7f), f2 - dp(context, 0.7f), f - dp(context, 0.7f)), f3, f3, paint);
        canvas.drawText(str, fDp, fDp2 - fontMetrics.top, paintBase);
        return bitmapCreateBitmap;
    }

    static Bitmap taskRow(Context context, String str, boolean z, float f) {
        float fDp = dp(context, 17.0f);
        Paint paintBase = base(sans(context, false), fDp, z ? FADED : INK, 0.0f);
        float fDp2 = dp(context, 36.0f);
        List<String> listWrap = wrap(paintBase, str, (f - fDp2) - dp(context, 6.0f));
        float fDp3 = dp(context, listWrap.size() > 1 ? 56.0f : 36.0f);
        Bitmap bitmapCreateBitmap = Bitmap.createBitmap(Math.max(1, (int) f), Math.max(1, (int) fDp3), Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmapCreateBitmap);
        float f2 = fDp3 / 2.0f;
        drawCheck(canvas, context, dp(context, 13.0f), f2, dp(context, 10.5f), z);
        float f3 = fDp * 1.3f;
        float size = f2 - ((listWrap.size() * f3) / 2.0f);
        Paint.FontMetrics fontMetrics = paintBase.getFontMetrics();
        for (int i = 0; i < listWrap.size(); i++) {
            canvas.drawText(listWrap.get(i), fDp2, ((i * f3) + size) - fontMetrics.top, paintBase);
        }
        return bitmapCreateBitmap;
    }

    private static void drawCheck(Canvas canvas, Context context, float f, float f2, float f3, boolean z) {
        Paint paint = new Paint(1);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeWidth(dp(context, 1.6f));
        if (z) {
            Paint paint2 = new Paint(1);
            paint2.setStyle(Paint.Style.FILL);
            paint2.setColor(ROSE);
            canvas.drawCircle(f, f2, f3, paint2);
            paint.setColor(ROSE);
            canvas.drawCircle(f, f2, f3, paint);
            Path path = new Path();
            path.moveTo(f - (0.48f * f3), (0.02f * f3) + f2);
            path.lineTo(f - (0.12f * f3), (0.38f * f3) + f2);
            path.lineTo(f + (0.52f * f3), f2 - (f3 * 0.4f));
            Paint paint3 = new Paint(5);
            paint3.setColor(CREAM);
            paint3.setStyle(Paint.Style.STROKE);
            paint3.setStrokeWidth(dp(context, 1.8f));
            paint3.setStrokeCap(Paint.Cap.ROUND);
            paint3.setStrokeJoin(Paint.Join.ROUND);
            canvas.drawPath(path, paint3);
            return;
        }
        paint.setColor(RING);
        canvas.drawCircle(f, f2, f3, paint);
    }

    private static List<String> wrap(Paint paint, String str, float f) {
        ArrayList arrayList = new ArrayList();
        String strTrim = str == null ? "" : str.trim();
        if (strTrim.isEmpty()) {
            arrayList.add("");
            return arrayList;
        }
        String[] strArrSplit = strTrim.split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (String str2 : strArrSplit) {
            if (!str2.isEmpty()) {
                if (sb.length() != 0) {
                    if (paint.measureText(((Object) sb) + " " + str2) <= f) {
                        sb.append(' ');
                        sb.append(str2);
                    } else {
                        arrayList.add(sb.toString());
                        if (arrayList.size() >= 2) {
                            arrayList.set(1, ellipsize(paint, ((String) arrayList.get(1)) + " " + str2, f));
                            return arrayList;
                        }
                        sb.setLength(0);
                        if (paint.measureText(str2) <= f) {
                            sb.append(str2);
                        } else {
                            arrayList.add(ellipsize(paint, str2, f));
                            if (arrayList.size() >= 2) {
                                return arrayList;
                            }
                        }
                    }
                } else if (paint.measureText(str2) <= f) {
                    sb.append(str2);
                } else {
                    arrayList.add(ellipsize(paint, str2, f));
                    if (arrayList.size() >= 2) {
                        return arrayList;
                    }
                }
            }
        }
        if (sb.length() > 0) {
            arrayList.add(sb.toString());
        }
        if (arrayList.size() <= 2) {
            return arrayList;
        }
        ArrayList arrayList2 = new ArrayList(arrayList.subList(0, 2));
        arrayList2.set(1, ellipsize(paint, ((String) arrayList.get(1)) + " " + ((String) arrayList.get(2)), f));
        return arrayList2;
    }

    static String ellipsize(Paint paint, String str, float f) {
        if (paint.measureText(str) <= f) {
            return str;
        }
        while (str.length() > 1) {
            if (paint.measureText(str + "…") <= f) {
                break;
            }
            str = str.substring(0, str.length() - 1);
        }
        return str + "…";
    }
}
