using System.Net;
namespace CourseIntellect.Infrastructure.Services;
internal static class OnboardingEmailTemplate
{
    public static string Wrap(string title, string content) => $"""
        <!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
        <body style="margin:0;background:#f5f5f7;font-family:Arial,sans-serif;color:#171717">
        <div style="max-width:580px;margin:32px auto;background:white;border-radius:20px;overflow:hidden">
        <div style="padding:24px 32px;background:#080808;color:white"><img src="https://schoolasist.com/images/logo.png" width="38" height="38" alt="SchoolAsist" style="vertical-align:middle;margin-right:10px"><strong style="font-size:22px">SchoolAsist</strong></div>
        <div style="padding:32px;line-height:1.7"><p style="font-size:12px;color:#ab4e08;text-transform:uppercase">{WebUtility.HtmlEncode(title)}</p>{content}</div>
        <div style="border-top:1px solid #eee;padding:22px 32px;font-size:12px;color:#777">Maydanoz Yazılım · <a href="mailto:info@schoolasist.com" style="color:#a74b06">info@schoolasist.com</a><br>0850 242 84 25<br>Parolanızı kimseyle paylaşmayın. SchoolAsist destek ekibi parolanızı istemez.</div>
        </div></body></html>
        """;
}
