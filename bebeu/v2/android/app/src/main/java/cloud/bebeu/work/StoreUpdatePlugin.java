package cloud.bebeu.work;

import android.content.Intent;
import android.net.Uri;
import android.content.ActivityNotFoundException;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "StoreUpdate")
public class StoreUpdatePlugin extends Plugin {
    @PluginMethod
    public void openStore(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            try {
                Intent store = new Intent(Intent.ACTION_VIEW,
                    Uri.parse("market://details?id=cloud.bebeu.work"));
                store.setPackage("com.android.vending");
                getActivity().startActivity(store);
                call.resolve();
            } catch (ActivityNotFoundException error) {
                try {
                    getActivity().startActivity(new Intent(Intent.ACTION_VIEW,
                        Uri.parse("https://play.google.com/store/apps/details?id=cloud.bebeu.work")));
                    call.resolve();
                } catch (ActivityNotFoundException fallbackError) {
                    call.reject("Play 스토어를 열 수 없습니다.");
                }
            }
        });
    }
}
