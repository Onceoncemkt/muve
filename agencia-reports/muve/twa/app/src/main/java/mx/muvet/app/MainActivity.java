package mx.muvet.app;

import android.net.Uri;
import android.os.Bundle;
import androidx.appcompat.app.AppCompatActivity;
import com.google.androidbrowserhelper.trusted.TwaLauncher;

public class MainActivity extends AppCompatActivity {
    private static final Uri LAUNCH_URL = Uri.parse("https://muvet.mx");

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        new TwaLauncher(this).launch(LAUNCH_URL);
    }
}
