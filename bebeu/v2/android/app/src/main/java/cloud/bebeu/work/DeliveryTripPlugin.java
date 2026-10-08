package cloud.bebeu.work;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Build;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.lang.ref.WeakReference;

@CapacitorPlugin(name = "DeliveryTrip", permissions = {
    @Permission(alias = "location", strings = {Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}),
    @Permission(alias = "notifications", strings = {Manifest.permission.POST_NOTIFICATIONS})
})
public class DeliveryTripPlugin extends Plugin {
    private static WeakReference<DeliveryTripPlugin> observer = new WeakReference<>(null);
    private LocationManager manager;
    private LocationListener listener;
    private PluginCall pendingStart;

    @Override public void load() { observer = new WeakReference<>(this); }

    static void emit(String event, JSObject data) {
        DeliveryTripPlugin plugin = observer.get();
        if (plugin != null && plugin.getActivity() != null) {
            plugin.getActivity().runOnUiThread(() -> {
                plugin.notifyListeners(event, data);
                if ("state".equals(event) && plugin.pendingStart != null) {
                    if (data.optBoolean("active")) plugin.pendingStart.resolve();
                    else plugin.pendingStart.reject("배송을 시작하지 못했습니다. 위치 서비스를 확인해 주세요.");
                    plugin.pendingStart = null;
                }
            });
        }
    }

    private boolean locationGranted() {
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACCESS_COARSE_LOCATION)
            == android.content.pm.PackageManager.PERMISSION_GRANTED;
    }

    @PluginMethod public void watchLocation(PluginCall call) {
        if (!locationGranted()) requestPermissionForAlias("location", call, "locationPermission");
        else beginWatch(call);
    }

    @PermissionCallback private void locationPermission(PluginCall call) {
        if (!locationGranted()) call.reject("위치 권한을 허용해 주세요.");
        else beginWatch(call);
    }

    private void beginWatch(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            removeWatch();
            manager = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
            listener = location -> emit("location", DeliveryTripService.locationJson(location));
            try {
                boolean enabled = false;
                for (String provider : new String[]{LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER}) {
                    if (!manager.isProviderEnabled(provider)) continue;
                    enabled = true;
                    manager.requestLocationUpdates(provider, 2000L, 2f, listener);
                    Location last = manager.getLastKnownLocation(provider);
                    if (last != null && System.currentTimeMillis() - last.getTime() < 60000L) listener.onLocationChanged(last);
                }
                if (!enabled) { removeWatch(); call.reject("휴대폰의 위치 서비스를 켜주세요."); }
                else call.resolve();
            } catch (SecurityException error) { removeWatch(); call.reject("위치 권한을 허용해 주세요."); }
        });
    }

    private void removeWatch() {
        if (manager != null && listener != null) manager.removeUpdates(listener);
        listener = null;
    }

    @PluginMethod public void stopWatch(PluginCall call) {
        getActivity().runOnUiThread(this::removeWatch);
        call.resolve();
    }

    @PluginMethod public void start(PluginCall call) {
        if (!locationGranted() || (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED)) {
            requestPermissionForAliases(Build.VERSION.SDK_INT >= 33 ? new String[]{"location", "notifications"} : new String[]{"location"}, call, "startPermission");
        } else beginTrip(call);
    }

    @PermissionCallback private void startPermission(PluginCall call) {
        if (!locationGranted()) { call.reject("배송 시작에는 위치 권한이 필요합니다."); return; }
        if (Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED) {
            call.reject("배송지 알림을 받으려면 알림 권한을 허용해 주세요."); return;
        }
        beginTrip(call);
    }

    private void beginTrip(PluginCall call) {
        String userId = call.getString("userId", "");
        com.getcapacitor.JSArray route = call.getArray("route");
        if (userId.isEmpty() || route == null || route.length() == 0 || route.length() > 100) {
            call.reject("먼저 배송 동선을 만들어 주세요."); return;
        }
        getActivity().runOnUiThread(() -> {
            try {
                pendingStart = call;
                Intent intent = new Intent(getContext(), DeliveryTripService.class).setAction("start");
                intent.putExtra("route", route.toString());
                intent.putExtra("userId", userId);
                ContextCompat.startForegroundService(getContext(), intent);
            } catch (RuntimeException error) {
                pendingStart = null;
                call.reject("배송 위치 공유를 시작하지 못했습니다. 앱을 화면에 열고 다시 시도해 주세요.");
            }
        });
    }

    @PluginMethod public void command(PluginCall call) {
        String action = call.getString("action", "");
        if (!java.util.Arrays.asList("previous", "next", "stop").contains(action)) { call.reject("잘못된 배송 명령입니다."); return; }
        if (DeliveryTripService.snapshot(getContext()).optBoolean("active")) {
            getContext().startService(new Intent(getContext(), DeliveryTripService.class).setAction(action));
        }
        call.resolve();
    }

    @PluginMethod public void getState(PluginCall call) { call.resolve(DeliveryTripService.snapshot(getContext())); }

    @Override protected void handleOnPause() {
        removeWatch();
        emit("watchStopped", new JSObject());
    }

    @Override protected void handleOnDestroy() {
        removeWatch();
        if (pendingStart != null) pendingStart.reject("배송 시작이 중단되었습니다.");
        if (observer.get() == this) observer.clear();
    }
}
