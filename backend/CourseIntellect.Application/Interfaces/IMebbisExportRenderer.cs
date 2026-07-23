using CourseIntellect.Application.DTOs.DrivingMebbis;

namespace CourseIntellect.Application.Interfaces;

/// <summary>MEBBİS dışa aktarım belgesini Excel (.xlsx) ve PDF çıktısına çevirir.</summary>
public interface IMebbisExportRenderer
{
    /// <summary>Fotoğraf sütunu varsa görselleri hücreye gömer.</summary>
    byte[] ToXlsx(MebbisExportDocument document);
    byte[] ToPdf(MebbisExportDocument document);
}
