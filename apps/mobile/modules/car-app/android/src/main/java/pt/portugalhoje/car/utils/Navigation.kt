package pt.portugalhoje.car.utils

import android.content.Intent
import android.net.Uri
import androidx.car.app.CarContext
import androidx.car.app.CarToast
import java.util.Locale

/**
 * Apps POI não podem calcular nem desenhar rotas: o destino é entregue à app de navegação
 * do carro (Google Maps, Waze, …), que calcula o caminho a partir da posição atual.
 */
fun navigateTo(carContext: CarContext, latitude: Double, longitude: Double) {
    val uri = Uri.parse(String.format(Locale.US, "geo:%.6f,%.6f", latitude, longitude))
    runCatching {
        carContext.startCarApp(Intent(CarContext.ACTION_NAVIGATE, uri))
    }.onFailure {
        CarToast.makeText(carContext, "Sem app de navegação disponível.", CarToast.LENGTH_LONG).show()
    }
}
