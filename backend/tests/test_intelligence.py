import unittest
from dashboard.intelligence import compute_price_intelligence

class TestPriceIntelligence(unittest.TestCase):

    def test_case_1_overpriced(self):
        # our_price = 1200, competitor_prices = [1000, 1100, 1300]
        # Expected: min=1000, status=OVERPRICED, alert=HIGH_RISK, rank=3, recommended=999
        res = compute_price_intelligence(1200, [1000, 1100, 1300])
        self.assertEqual(res["min_price"], 1000)
        self.assertEqual(res["status"], "OVERPRICED")
        self.assertEqual(res["alert"], "HIGH_RISK")
        self.assertEqual(res["rank"], 3)
        self.assertEqual(res["recommended_price"], 999)

    def test_case_2_leader(self):
        # our_price = 900, competitor_prices = [1000, 1100]
        # Expected: status=LEADER, opportunity=INCREASE_PRICE, recommended ≈ 945 (900 * 1.05)
        res = compute_price_intelligence(900, [1000, 1100])
        self.assertEqual(res["status"], "LEADER")
        self.assertEqual(res["opportunity"], "INCREASE_PRICE")
        self.assertEqual(res["recommended_price"], 945.0)

    def test_case_3_competitive(self):
        # our_price = 1000, competitor_prices = [1000, 1100]
        # Expected: status=COMPETITIVE, no alert, recommended=1000
        res = compute_price_intelligence(1000, [1000, 1100])
        self.assertEqual(res["status"], "COMPETITIVE")
        self.assertIsNone(res["alert"])
        self.assertEqual(res["recommended_price"], 1000)

    def test_case_4_volatile_market(self):
        # our_price = 1000, competitor_prices = [1000, 1500]
        # Expected: market_type=VOLATILE
        res = compute_price_intelligence(1000, [1000, 1500])
        self.assertEqual(res["market_type"], "VOLATILE")

    def test_case_5_tight_market(self):
        # our_price = 1000, competitor_prices = [990, 1010]
        # Expected: market_type=STABLE, alert=MEDIUM_RISK
        res = compute_price_intelligence(1000, [990, 1010])
        self.assertEqual(res["market_type"], "STABLE")
        self.assertEqual(res["alert"], "MEDIUM_RISK")

if __name__ == "__main__":
    unittest.main()
