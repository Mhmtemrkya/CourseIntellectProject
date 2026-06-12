using System.Security.Claims;
using CourseIntellect.Api.Controllers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace CourseIntellect.Tests;

public sealed class CafeteriaControllerTests : IDisposable
{
    private readonly TestDb db = new();

    private CafeteriaController CreateController()
    {
        var controller = new CafeteriaController(db.Context)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(
                        [new Claim("unique_name", "test-yemekhane")], "test")),
                },
            },
        };
        return controller;
    }

    [Fact]
    public async Task GetWeek_ReturnsEmptyWeekTemplate_WhenNoMenuSaved()
    {
        var controller = CreateController();
        var result = await controller.GetWeek(null, CancellationToken.None);
        var ok = Assert.IsType<OkObjectResult>(result);
        var week = Assert.IsType<CafeteriaWeekSnapshot>(ok.Value);
        Assert.Equal(14, week.Meals.Count); // 7 gün x 2 öğün
        Assert.Equal(DayOfWeek.Monday, week.WeekStart.DayOfWeek);
    }

    [Fact]
    public async Task SaveWeek_ThenGetWeek_RoundTrips()
    {
        var controller = CreateController();
        var monday = new DateOnly(2026, 6, 8);
        var save = await controller.SaveWeek(new CafeteriaWeekRequest
        {
            WeekStart = monday,
            Note = "Test haftası",
            Meals =
            [
                new CafeteriaMealEntryRequest
                {
                    Date = monday,
                    MealType = "Lunch",
                    Items = ["Mercimek çorbası", "Pilav"],
                    Calories = 650,
                },
            ],
        }, CancellationToken.None);
        Assert.IsType<OkObjectResult>(save);

        var get = await controller.GetWeek(monday, CancellationToken.None);
        var ok = Assert.IsType<OkObjectResult>(get);
        var week = Assert.IsType<CafeteriaWeekSnapshot>(ok.Value);
        var lunch = week.Meals.Single(m => m.Date == monday && m.MealType == "Lunch");
        Assert.Contains("Pilav", lunch.Items);
    }

    public void Dispose() => db.Dispose();
}
