package ods.bubbas.umbra;

import android.app.Activity;
import android.content.ContentValues;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity {

    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Dark system bars styling
        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(Color.parseColor("#0b0c0a"));
        window.setNavigationBarColor(Color.parseColor("#0b0c0a"));
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            View decor = window.getDecorView();
            decor.setSystemUiVisibility(decor.getSystemUiVisibility() & ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        }

        webView = new WebView(this);
        setContentView(webView);

        webView.setBackgroundColor(Color.parseColor("#0b0c0a"));

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);

        // Expose JavaScript bridge "UmbraAndroid"
        webView.addJavascriptInterface(new UmbraBridge(), "UmbraAndroid");

        // Custom WebViewClient serving only umbra.local assets from assets/www, blocking all external hosts
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (uri != null && "umbra.local".equalsIgnoreCase(uri.getHost())) {
                    String path = uri.getPath();
                    if (path == null || path.isEmpty() || "/".equals(path)) {
                        path = "/index.html";
                    }
                    if (path.startsWith("/")) {
                        path = path.substring(1);
                    }
                    String assetPath = "www/" + path;
                    try {
                        InputStream is = getAssets().open(assetPath);
                        String mimeType = getMimeType(path);
                        String encoding = isTextMime(mimeType) ? "utf-8" : null;
                        Map<String, String> headers = new HashMap<>();
                        headers.put("Access-Control-Allow-Origin", "*");
                        headers.put("Cache-Control", "no-cache, no-store, must-revalidate");
                        return new WebResourceResponse(mimeType, encoding, 200, "OK", headers, is);
                    } catch (Exception e) {
                        return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null,
                                new ByteArrayInputStream("Recurso no encontrado".getBytes(StandardCharsets.UTF_8)));
                    }
                }

                // Block external network hosts
                return new WebResourceResponse("text/plain", "utf-8", 403, "Forbidden", null,
                        new ByteArrayInputStream("Acceso bloqueado: host externo".getBytes(StandardCharsets.UTF_8)));
            }
        });

        // Load root from virtual host
        webView.loadUrl("https://umbra.local/index.html");
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    private static String getMimeType(String path) {
        String lower = path.toLowerCase();
        if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html";
        if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "application/javascript";
        if (lower.endsWith(".css")) return "text/css";
        if (lower.endsWith(".json")) return "application/json";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".webp")) return "image/webp";
        if (lower.endsWith(".ico")) return "image/x-icon";
        if (lower.endsWith(".woff2")) return "font/woff2";
        if (lower.endsWith(".woff")) return "font/woff";
        if (lower.endsWith(".ttf")) return "font/ttf";
        return "application/octet-stream";
    }

    private static boolean isTextMime(String mimeType) {
        return mimeType.startsWith("text/") || mimeType.contains("javascript") || mimeType.contains("json");
    }

    public class UmbraBridge {

        @JavascriptInterface
        public void saveText(String nombre, String mimeType, String contenido) {
            if (nombre == null || nombre.trim().isEmpty()) {
                nombre = "umbra-export.txt";
            }
            if (mimeType == null || mimeType.trim().isEmpty()) {
                mimeType = "application/json";
            }
            if (contenido == null) {
                contenido = "";
            }

            final String finalNombre = nombre;
            boolean success = false;

            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.Downloads.DISPLAY_NAME, finalNombre);
                    values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
                    values.put(MediaStore.Downloads.IS_PENDING, 1);

                    Uri collection = MediaStore.Downloads.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
                    Uri itemUri = getContentResolver().insert(collection, values);
                    if (itemUri != null) {
                        try (OutputStream out = getContentResolver().openOutputStream(itemUri)) {
                            if (out != null) {
                                out.write(contenido.getBytes(StandardCharsets.UTF_8));
                                out.flush();
                            }
                        }
                        values.clear();
                        values.put(MediaStore.Downloads.IS_PENDING, 0);
                        getContentResolver().update(itemUri, values, null, null);
                        success = true;
                    }
                } else {
                    File downloadsDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    if (!downloadsDir.exists()) {
                        downloadsDir.mkdirs();
                    }
                    File file = new File(downloadsDir, finalNombre);
                    try (FileOutputStream fos = new FileOutputStream(file)) {
                        fos.write(contenido.getBytes(StandardCharsets.UTF_8));
                        fos.flush();
                    }
                    success = true;
                }
            } catch (Exception e) {
                e.printStackTrace();
            }

            final boolean isOk = success;
            runOnUiThread(() -> {
                if (isOk) {
                    Toast.makeText(MainActivity.this, "Guardado en Descargas: " + finalNombre, Toast.LENGTH_LONG).show();
                } else {
                    Toast.makeText(MainActivity.this, "Error al guardar: " + finalNombre, Toast.LENGTH_SHORT).show();
                }
            });
        }
    }
}
