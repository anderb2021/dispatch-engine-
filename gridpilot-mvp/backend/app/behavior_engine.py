class BehaviorEngine:
    def infer_user_behavior(self, charging_sessions):
        return {
            "typical_arrival_time": "19:10",
            "typical_departure_time": "07:20",
            "flexibility_score": 0.82,
            "override_probability": 0.06,
            "dispatch_reliability_score": 0.91,
        }