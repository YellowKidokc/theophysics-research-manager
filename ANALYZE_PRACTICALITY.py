"""
Quick script to analyze what we've built and suggest simplifications.
Run this to see what's essential vs. over-engineered.
"""

from core.practicality_analyzer import PracticalityAnalyzer

if __name__ == "__main__":
    analyzer = PracticalityAnalyzer()
    report = analyzer.generate_report()
    print(report)
    
    # Also save to file
    with open("PRACTICALITY_REPORT.txt", "w", encoding="utf-8") as f:
        f.write(report)
    
    print("\n" + "=" * 60)
    print("Report also saved to: PRACTICALITY_REPORT.txt")
    print("=" * 60)

