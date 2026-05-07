class RewardEngine:
    def calculate_reward(self, shifted_kwh, rate_per_kwh=0.12):
        return round(shifted_kwh * rate_per_kwh, 2)