package cloud.bebeu.work;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;
import com.getcapacitor.JSObject;
import org.json.JSONArray;
import org.json.JSONObject;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class DeliveryTripService extends Service {
    private static final int NOTIFICATION_ID = 4201;
    private static final String CHANNEL = "delivery-trip";
    private static volatile boolean running = false;
    private JSONArray route = new JSONArray();
    private int index = 0;
    private String userId = "";
    private LocationManager manager;
    private LocationListener listener;
    private final ExecutorService network = Executors.newSingleThreadExecutor();
    private volatile long lastSent = 0;
    private volatile boolean uploading = false;
    private volatile boolean ended = false;

    private static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences("delivery-trip", Context.MODE_PRIVATE);
    }

    static JSObject snapshot(Context context) {
        JSObject result = new JSObject();
        if (!running) { result.put("active", false); return result; }
        try { return new JSObject(preferences(context).getString("state", "{\"active\":false}")); }
        catch (Exception error) { result.put("active", false); return result; }
    }

    static JSObject locationJson(Location location) {
        JSObject result = new JSObject();
        result.put("latitude", location.getLatitude()); result.put("longitude", location.getLongitude());
        result.put("accuracy", location.getAccuracy());
        result.put("heading", location.hasBearing() ? location.getBearing() : JSONObject.NULL);
        result.put("speed", location.hasSpeed() ? location.getSpeed() : JSONObject.NULL);
        result.put("timestamp", location.getTime());
        return result;
    }

    private void publishState(boolean active) {
        running = active;
        JSObject state = new JSObject();
        state.put("active", active); state.put("index", index); state.put("route", route); state.put("userId", userId);
        preferences(this).edit().putString("state", state.toString()).apply();
        DeliveryTripPlugin.emit("state", state);
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? "stop" : intent.getAction();
        if ("stop".equals(action)) { finishTrip(); return START_NOT_STICKY; }
        try {
            if ("start".equals(action)) {
                route = new JSONArray(intent.getStringExtra("route")); userId = intent.getStringExtra("userId"); index = 0;
                if (route.length() == 0 || userId == null || userId.isEmpty()) throw new IllegalArgumentException();
                ended = false;
            } else {
                if (route.length() == 0) { finishTrip(); return START_NOT_STICKY; }
                if ("previous".equals(action)) index = Math.max(0, index - 1);
                if ("next".equals(action)) index = Math.min(route.length() - 1, index + 1);
            }
            showNotification();
            if ("start".equals(action)) startLocation();
            publishState(true);
        } catch (Exception error) {
            DeliveryTripPlugin.emit("error", new JSObject().put("message", "배송을 시작하지 못했습니다. 위치 권한과 위치 서비스를 확인해 주세요."));
            finishTrip();
        }
        return START_NOT_STICKY;
    }

    private PendingIntent command(String action, int id) {
        return PendingIntent.getService(this, id, new Intent(this, DeliveryTripService.class).setAction(action),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private void showNotification() {
        NotificationManager notifications = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26) notifications.createNotificationChannel(new NotificationChannel(CHANNEL, "배송 동선", NotificationManager.IMPORTANCE_LOW));
        JSONObject stop = route.optJSONObject(index);
        String address = stop == null ? "" : stop.optString("address");
        PendingIntent open = PendingIntent.getActivity(this, 4200, new Intent(this, MainActivity.class)
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP), PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentTitle("다음 배송 위치 " + (index + 1) + "/" + route.length())
            .setContentText(address).setStyle(new NotificationCompat.BigTextStyle().bigText(address))
            .setContentIntent(open).setOngoing(true).setOnlyAlertOnce(true)
            .setCategory(NotificationCompat.CATEGORY_NAVIGATION).setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .addAction(0, "이전", command("previous", 4202))
            .addAction(0, "다음", command("next", 4203))
            .addAction(0, "종료", command("stop", 4204));
        startForeground(NOTIFICATION_ID, builder.build());
    }

    private void startLocation() {
        if (listener != null) manager.removeUpdates(listener);
        manager = (LocationManager) getSystemService(LOCATION_SERVICE);
        listener = location -> {
            if (ended || System.currentTimeMillis() - location.getTime() > 60000L) return;
            JSObject point = locationJson(location);
            DeliveryTripPlugin.emit("location", point);
            if (uploading || System.currentTimeMillis() - lastSent < 3000L) return;
            uploading = true;
            String owner = userId;
            network.execute(() -> {
                HttpURLConnection connection = null;
                try {
                    if (ended) return;
                    // Keep authenticated location updates on the application's trusted HTTPS server.
                    connection = (HttpURLConnection) new URL("https://app.bebeu.cloud/api/delivery/location").openConnection();
                    connection.setConnectTimeout(8000); connection.setReadTimeout(8000); connection.setInstanceFollowRedirects(false);
                    connection.setRequestMethod("POST"); connection.setDoOutput(true);
                    connection.setRequestProperty("Content-Type", "application/json"); connection.setRequestProperty("X-User-Id", owner);
                    try (java.io.OutputStream output = connection.getOutputStream()) { output.write(point.toString().getBytes(StandardCharsets.UTF_8)); }
                    int status = connection.getResponseCode();
                    if (status >= 200 && status < 300) lastSent = System.currentTimeMillis();
                    else DeliveryTripPlugin.emit("error", new JSObject().put("message", "배송 위치 공유가 지연되고 있습니다. 네트워크와 로그인 상태를 확인해 주세요."));
                } catch (Exception error) {
                    DeliveryTripPlugin.emit("error", new JSObject().put("message", "배송 위치 공유가 지연되고 있습니다. 네트워크를 확인해 주세요."));
                } finally { if (connection != null) connection.disconnect(); uploading = false; }
            });
        };
        boolean enabled = false;
        for (String provider : new String[]{LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER}) {
            if (manager.isProviderEnabled(provider)) { enabled = true; manager.requestLocationUpdates(provider, 2000L, 2f, listener); }
        }
        if (!enabled) throw new IllegalStateException("Location disabled");
    }

    private void finishTrip() {
        ended = true;
        if (manager != null && listener != null) manager.removeUpdates(listener);
        listener = null;
        route = new JSONArray();
        index = 0;
        userId = "";
        publishState(false);
        stopForeground(STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    @Override public void onDestroy() { finishTrip(); network.shutdownNow(); super.onDestroy(); }
    @Override public void onTaskRemoved(Intent intent) { finishTrip(); }
    @Override public IBinder onBind(Intent intent) { return null; }
}
