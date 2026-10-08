package pt.portugalhoje.auto

import androidx.car.app.CarAppService
import androidx.car.app.Session
import androidx.car.app.validation.HostValidator

class PortugalHojeCarAppService : CarAppService() {
    // Em release só aceita hosts oficiais (Android Auto / Automotive) assinados pela Google;
    // em debug aceita qualquer host para permitir testes no Desktop Head Unit.
    override fun createHostValidator(): HostValidator =
        if (BuildConfig.DEBUG) {
            HostValidator.ALLOW_ALL_HOSTS_VALIDATOR
        } else {
            HostValidator.Builder(applicationContext)
                .addAllowedHosts(androidx.car.app.R.array.hosts_allowlist_sample)
                .build()
        }

    override fun onCreateSession(): Session = PortugalHojeSession()
}
