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

builder.Services.AddCors(options =>
{
	options.AddPolicy("VetiFlowClient", policy =>
	{
		policy
				.WithOrigins(
						"https://vetiflow.vercel.app",
						"https://localhost:52540")
				.AllowAnyHeader()
				.AllowAnyMethod()
				.AllowCredentials();
	});
});

// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
	using var scope = app.Services.CreateScope();

	var dbContext = scope.ServiceProvider
			.GetRequiredService<VetiFlowDbContext>();

	await DbSeeder.SeedAsync(dbContext);

	app.MapOpenApi();
}

app.UseHttpsRedirection();

app.UseCors("VetiFlowClient");

app.UseAuthorization();

app.MapControllers();

app.Run();