class DispatchEngine:
    def should_delay_charging(self, flexibility_score, override_probability):
        return flexibility_score > 0.7 and override_probability < 0.15