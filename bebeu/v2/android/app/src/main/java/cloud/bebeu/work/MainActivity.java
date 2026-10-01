package cloud.bebeu.work;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.view.DragEvent;
import android.view.DragAndDropPermissions;
import android.content.ClipData;
import android.net.Uri;
import java.io.File;
import java.io.InputStream;
import java.io.FileOutputStream;
import java.util.UUID;
import org.json.JSONArray;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        File[] cachedDrops = getCacheDir().listFiles((dir, name) -> name.startsWith("drop-"));
        if (cachedDrops != null) {
            for (File file : cachedDrops) {
                if (file.lastModified() < System.currentTimeMillis() - 86400000L) file.delete();
            }
        }
        bridge.getWebView().setOnDragListener((view, event) -> {
            if (event.getAction() == DragEvent.ACTION_DRAG_STARTED) {
                return event.getClipDescription() != null
                    && (event.getClipDescription().hasMimeType("image/*")
                        || event.getClipDescription().hasMimeType("text/uri-list"));
            }
            if (event.getAction() != DragEvent.ACTION_DROP) return true;
            ClipData clip = event.getClipData();
            if (clip == null) return false;
            DragAndDropPermissions permission = requestDragAndDropPermissions(event);
            float density = getResources().getDisplayMetrics().density;
            float x = event.getX() / density;
            float y = event.getY() / density;
            new Thread(() -> {
                JSONArray photos = new JSONArray();
                try {
                    for (int i = 0; i < Math.min(clip.getItemCount(), 100); i++) {
                        Uri uri = clip.getItemAt(i).getUri();
                        if (uri == null || !"content".equals(uri.getScheme())) continue;
                        String mime = getContentResolver().getType(uri);
                        if (mime == null || !mime.startsWith("image/")) continue;
                        File file = new File(getCacheDir(), "drop-" + UUID.randomUUID());
                        try (InputStream input = getContentResolver().openInputStream(uri);
                             FileOutputStream output = new FileOutputStream(file)) {
                            if (input == null) continue;
                            byte[] buffer = new byte[65536];
                            int count;
                            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
                        }
                        file.deleteOnExit();
                        JSONObject photo = new JSONObject();
                        photo.put("path", Uri.fromFile(file).toString());
                        photo.put("format", mime.substring(6));
                        photos.put(photo);
                    }
                    JSONObject data = new JSONObject();
                    data.put("photos", photos);
                    data.put("x", x);
                    data.put("y", y);
                    runOnUiThread(() -> bridge.triggerJSEvent("bebeuPhotoDrop", "window", data.toString()));
                } catch (Exception error) {
                    runOnUiThread(() -> bridge.triggerJSEvent("bebeuPhotoDropError", "window"));
                } finally {
                    if (permission != null) permission.release();
                }
            }, "bebeu-photo-drop").start();
            return true;
        });
    }
}
