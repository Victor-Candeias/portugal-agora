package pt.portugalhoje.auto.screens

import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.model.Action
import androidx.car.app.model.ItemList
import androidx.car.app.model.ListTemplate
import androidx.car.app.model.MessageTemplate
import androidx.car.app.model.Row
import androidx.car.app.model.Template
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import pt.portugalhoje.auto.api.EvApi
import pt.portugalhoje.auto.api.EvChargeCost
import pt.portugalhoje.auto.utils.contentLimit
import java.text.NumberFormat
import java.util.Locale
import kotlin.math.roundToLong

private val LOCALE_PT = Locale.forLanguageTag("pt-PT")
private const val EV_TITLE = "Carregamento EV"

private fun euro(value: Double): String = NumberFormat.getCurrencyInstance(LOCALE_PT).format(value)

private fun round2(value: Double): Double = (value * 100).roundToLong() / 100.0

/** Custo de um carregamento de [kwh] por CEME, do mais barato para o mais caro (mesma conta da API). */
private fun costsFor(tariffs: List<EvChargeCost>, kwh: Int): List<Pair<EvChargeCost, Double>> =
    tariffs
        .map { it to round2(round2(it.price_per_kwh_eur * kwh) + it.activation_fee_eur) }
        .sortedBy { it.second }

/**
 * Escolha da quantidade de energia (como os chips do mobile). Cada opção abre o ranking por CEME
 * num ecrã próprio — alterar o conteúdo deste ecrã contaria para o limite de passos do Android Auto.
 */
class EvScreen(carContext: CarContext) : Screen(carContext) {
    private var requested = false
    private var loading = true
    private var tariffs: List<EvChargeCost> = emptyList()
    private var period: String? = null
    private var errorMessage: String? = null

    override fun onGetTemplate(): Template {
        ensureLoaded()

        errorMessage?.let {
            return MessageTemplate.Builder(it)
                .setTitle(EV_TITLE)
                .setHeaderAction(Action.BACK)
                .build()
        }

        if (loading) {
            return ListTemplate.Builder()
                .setTitle(EV_TITLE)
                .setHeaderAction(Action.BACK)
                .setLoading(true)
                .build()
        }

        if (tariffs.isEmpty()) {
            return MessageTemplate.Builder("Sem tarifas disponíveis.")
                .setTitle(EV_TITLE)
                .setHeaderAction(Action.BACK)
                .build()
        }

        val periodLabel = period?.let { PERIOD_LABELS[it] ?: it }
        val itemList = ItemList.Builder().apply {
            KWH_OPTIONS.forEach { kwh ->
                val (cheapest, total) = costsFor(tariffs, kwh).first()
                addItem(
                    Row.Builder()
                        .setTitle("$kwh kWh")
                        .addText("Desde ${euro(total)} · ${cheapest.ceme}")
                        .setBrowsable(true)
                        .setOnClickListener {
                            screenManager.push(EvRankingScreen(carContext, kwh, tariffs, periodLabel))
                        }
                        .build(),
                )
            }
        }.build()

        return ListTemplate.Builder()
            .setTitle(if (periodLabel != null) "$EV_TITLE · tarifa $periodLabel" else EV_TITLE)
            .setHeaderAction(Action.BACK)
            .setSingleList(itemList)
            .build()
    }

    private fun ensureLoaded() {
        if (requested) return
        requested = true
        lifecycleScope.launch {
            runCatching {
                withContext(Dispatchers.IO) { EvApi.getCheapest(REFERENCE_KWH) }
            }.onSuccess { result ->
                tariffs = result.data.orEmpty()
                period = result.meta?.current_period
            }.onFailure { throwable ->
                errorMessage = throwable.message ?: "Não foi possível carregar as tarifas."
            }
            loading = false
            invalidate()
        }
    }

    companion object {
        private const val REFERENCE_KWH = 30
        private val KWH_OPTIONS = listOf(10, 20, 30, 50)
        private val PERIOD_LABELS = mapOf(
            "vazio" to "vazio",
            "fora_vazio" to "fora de vazio",
            "simples" to "simples",
        )
    }
}

class EvRankingScreen(
    carContext: CarContext,
    private val kwh: Int,
    private val tariffs: List<EvChargeCost>,
    private val periodLabel: String?,
) : Screen(carContext) {
    override fun onGetTemplate(): Template {
        val itemList = ItemList.Builder().apply {
            costsFor(tariffs, kwh).take(contentLimit(carContext)).forEachIndexed { index, (cost, total) ->
                val activation = if (cost.activation_fee_eur > 0) " + ativação ${euro(cost.activation_fee_eur)}" else ""
                addItem(
                    Row.Builder()
                        .setTitle("${index + 1}. ${cost.ceme} — ${euro(total)}")
                        .addText("${"%.4f".format(LOCALE_PT, cost.price_per_kwh_eur)} €/kWh$activation")
                        .build(),
                )
            }
        }.build()

        return ListTemplate.Builder()
            .setTitle("$EV_TITLE · $kwh kWh" + (periodLabel?.let { " ($it)" } ?: ""))
            .setHeaderAction(Action.BACK)
            .setSingleList(itemList)
            .build()
    }
}
