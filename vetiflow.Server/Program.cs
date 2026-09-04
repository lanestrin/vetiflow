using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using vetiflow.Server.Data;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration
		.GetConnectionString("VetiFlowDatabase")
		?? throw new InvalidOperationException(
				"Connection string 'VetiFlowDatabase' was not found.");

// Add services to the container.
builder.Services
		.AddControllers()
		.AddJsonOptions(options =>
		{
			options.JsonSerializerOptions.Converters.Add(
					new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
		});

builder.Services.AddDbContext<VetiFlowDbContext>(options =>
		options.UseNpgsql(connectionString));

// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
	var dbContext = scope.ServiceProvider
			.GetRequiredService<VetiFlowDbContext>();

	await DbSeeder.SeedAsync(dbContext);
}

app.UseDefaultFiles();
app.MapStaticAssets();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
	app.MapOpenApi();
}

app.UseHttpsRedirection();

app.UseAuthorization();

app.MapControllers();

app.MapFallbackToFile("/index.html");

app.Run();