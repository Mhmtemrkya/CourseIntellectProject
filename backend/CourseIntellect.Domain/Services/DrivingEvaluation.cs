using CourseIntellect.Domain.Enums;

namespace CourseIntellect.Domain.Services;

public sealed record DrivingEvaluationCriterion(string Key, string Category, string Label, bool ManualOnly = false);

public static class DrivingEvaluation
{
    public const int Version = 1;

    public static readonly IReadOnlyList<DrivingEvaluationCriterion> Criteria =
    [
        new("trafficObservation", "trafficRules", "Trafik akışını gözlemleme"),
        new("signsAndSignals", "trafficRules", "İşaret ve ışıklara uyum"),
        new("laneDiscipline", "trafficRules", "Şerit disiplini"),
        new("speedManagement", "trafficRules", "Hız yönetimi"),
        new("rightOfWay", "trafficRules", "Geçiş hakkı kuralları"),
        new("followingDistance", "trafficRules", "Takip mesafesi"),

        new("seatingAndMirrors", "vehicleControl", "Koltuk ve ayna ayarı"),
        new("steeringControl", "vehicleControl", "Direksiyon hâkimiyeti"),
        new("pedalControl", "vehicleControl", "Gaz ve fren kontrolü"),
        new("gearSelection", "vehicleControl", "Doğru vites seçimi"),
        new("clutchControl", "vehicleControl", "Debriyaj kavrama kontrolü", true),
        new("clutchHillStart", "vehicleControl", "Debriyajla yokuş kalkışı", true),

        new("smoothStartStop", "maneuvers", "Yumuşak kalkış ve duruş"),
        new("parking", "maneuvers", "Park etme"),
        new("reversing", "maneuvers", "Geri sürüş"),
        new("turning", "maneuvers", "Dönüş ve U dönüşü"),
        new("hillStart", "maneuvers", "Yokuşta kalkış"),
        new("laneChange", "maneuvers", "Şerit değiştirme"),

        new("seatbeltAndChecks", "safety", "Emniyet kemeri ve son kontroller"),
        new("signaling", "safety", "Zamanında sinyal kullanımı"),
        new("blindSpot", "safety", "Kör nokta kontrolü"),
        new("pedestrianAwareness", "safety", "Yaya ve bisikletli farkındalığı"),
        new("hazardAnticipation", "safety", "Tehlikeyi önceden sezme"),
        new("calmDecisionMaking", "safety", "Sakin ve güvenli karar verme"),
    ];

    public static IReadOnlyList<DrivingEvaluationCriterion> For(TransmissionType transmissionType)
        => transmissionType == TransmissionType.Automatic
            ? Criteria.Where(x => !x.ManualOnly).ToList()
            : Criteria;

    public static string? Validate(IReadOnlyDictionary<string, int>? scores, TransmissionType transmissionType)
    {
        if (scores is null) return "24 kriterli sürüş değerlendirmesi zorunludur.";
        var expected = For(transmissionType).Select(x => x.Key).ToHashSet(StringComparer.Ordinal);
        var supplied = scores.Keys.ToHashSet(StringComparer.Ordinal);
        if (!expected.SetEquals(supplied))
            return transmissionType == TransmissionType.Automatic
                ? "Otomatik vites değerlendirmesinde debriyaj dışındaki 22 kriterin tamamı doldurulmalıdır."
                : "24 sürüş değerlendirme kriterinin tamamı doldurulmalıdır.";
        return scores.Values.Any(x => x is < 1 or > 5)
            ? "Değerlendirme puanları 1-5 arasında olmalıdır."
            : null;
    }

    public static int CategoryScore(IReadOnlyDictionary<string, int> scores, string category, TransmissionType transmissionType)
    {
        var values = For(transmissionType)
            .Where(x => x.Category == category)
            .Select(x => scores[x.Key])
            .ToList();
        return (int)Math.Round(values.Average(), MidpointRounding.AwayFromZero);
    }
}
