package pt.portugalhoje.auto.utils

import androidx.car.app.CarContext
import androidx.car.app.constraints.ConstraintManager
import androidx.car.app.versioning.CarAppApiLevels

private const val DEFAULT_LIMIT = 6

// Alguns hosts (ex.: DHU → 1000) devolvem limites muito altos; sem teto, um template com centenas de
// linhas excede o limite do Binder (TransactionTooLargeException → ANR no host).
private const val MAX_LIMIT = 20

/** Nº máximo de itens que o host aceita numa lista ([type] = ConstraintManager.CONTENT_LIMIT_TYPE_*). */
fun contentLimit(carContext: CarContext, type: Int = ConstraintManager.CONTENT_LIMIT_TYPE_LIST): Int {
    if (carContext.carAppApiLevel < CarAppApiLevels.LEVEL_2) return DEFAULT_LIMIT
    return runCatching {
        carContext.getCarService(ConstraintManager::class.java).getContentLimit(type)
    }.getOrDefault(DEFAULT_LIMIT).coerceIn(1, MAX_LIMIT)
}
