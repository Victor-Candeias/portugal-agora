package pt.portugalhoje.auto

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient

class MainActivity : Activity() {
    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.databaseEnabled = true
            settings.loadWithOverviewMode = true
            settings.useWideViewPort = true
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    val uri = request.url
                    return if (uri.scheme == "http" || uri.scheme == "https") {
                        false
                    } else {
                        openExternalUri(uri)
                        true
                    }
                }
            }
        }

        setContentView(webView)
        webView.loadUrl(PORTUGAL_AGORA_URL)
    }

    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    override fun onDestroy() {
        if (::webView.isInitialized) {
            webView.destroy()
        }
        super.onDestroy()
    }

    private fun openExternalUri(uri: Uri) {
        startActivity(Intent(Intent.ACTION_VIEW, uri))
    }

    companion object {
        private const val PORTUGAL_AGORA_URL = "https://victor-candeias.github.io/portugal-agora/"
    }
}
