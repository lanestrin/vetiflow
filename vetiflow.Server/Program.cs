using Microsoft.EntityFrameworkCore;
using vetiflow.Server.Data;
using vetiflow.Server.Hubs;
using vetiflow.Server.Json;

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
					// Enums by exactly one name: no numbers ("stage": 2), no undefined
					// values (99) and no comma lists (see NameOnlyEnumConverter).
					options.JsonSerializerOptions.Converters.Add(new NameOnlyEnumConverter());

					// The parser's own message names internal types; the 400 still
					// says which field was invalid.
					options.AllowInputFormatterExceptionMessages = false;
				});

builder.Services.AddDbContext<VetiFlowDbContext>(options =>
				options.UseNpgsql(connectionString));

builder.Services.AddSignalR();

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

// Migrating and seeding are off unless configured: on for local development
// and tests, off in production (see DatabaseStartup).
using (var scope = app.Services.CreateScope())
{
	await DatabaseStartup.PrepareAsync(
		scope.ServiceProvider.GetRequiredService<VetiFlowDbContext>(),
		migrateOnStartup: app.Configuration.GetValue<bool>("Database:MigrateOnStartup"),
		seedDemoData: app.Configuration.GetValue<bool>("Database:SeedDemoData"),
		app.Logger);
}

if (app.Environment.IsDevelopment())
{
	app.MapOpenApi();
}

app.UseHttpsRedirection();

app.UseCors("VetiFlowClient");

app.UseAuthorization();

app.MapControllers();

app.MapHub<CaseHub>("/hubs/cases");

app.Run();
