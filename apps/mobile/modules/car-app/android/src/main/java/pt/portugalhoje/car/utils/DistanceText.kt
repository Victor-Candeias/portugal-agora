package pt.portugalhoje.car.utils

import android.text.Spannable
import android.text.SpannableString
import androidx.car.app.model.Distance
import androidx.car.app.model.DistanceSpan

/**
 * PlaceListMapTemplate exige um DistanceSpan em todas as linhas não navegáveis;
 * o host substitui o carácter marcado pela distância formatada.
 */
fun distanceText(km: Double, suffix: String): CharSequence {
    val text = SpannableString("  · $suffix")
    text.setSpan(
        DistanceSpan.create(Distance.create(km, Distance.UNIT_KILOMETERS)),
        0,
        1,
        Spannable.SPAN_INCLUSIVE_INCLUSIVE,
    )
    return text
}
