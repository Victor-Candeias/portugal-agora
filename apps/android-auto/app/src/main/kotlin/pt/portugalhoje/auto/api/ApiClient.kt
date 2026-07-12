package pt.portugalhoje.auto.api

import com.google.gson.Gson
import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.Call
import okhttp3.Callback
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

object ApiClient {
    val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    val gson: Gson = Gson()

    suspend fun get(url: String, headers: Map<String, String> = emptyMap()): String =
        suspendCancellableCoroutine { continuation ->
            val request = Request.Builder().url(url).apply {
                headers.forEach { (name, value) ->
                    addHeader(name, value)
                }
            }.build()

            val call: Call = client.newCall(request)
            continuation.invokeOnCancellation { call.cancel() }

            call.enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    if (continuation.isCancelled) {
                        return
                    }
                    continuation.resumeWithException(e)
                }

                override fun onResponse(call: Call, response: Response) {
                    response.use {
                        if (!response.isSuccessful) {
                            continuation.resumeWithException(IOException("HTTP ${response.code}"))
                            return
                        }

                        val body = response.body?.string()
                        if (body == null) {
                            continuation.resumeWithException(IOException("Empty response body"))
                        } else {
                            continuation.resume(body)
                        }
                    }
                }
            })
        }
}
