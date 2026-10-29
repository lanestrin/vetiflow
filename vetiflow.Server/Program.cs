using Microsoft.AspNetCore.Authentication.BearerToken;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using vetiflow.Server.Data;
using vetiflow.Server.Hosting;
using vetiflow.Server.Hubs;
using vetiflow.Server.Json;
using vetiflow.Server.Models;

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

// No planned request comes close to 1 MB (no file uploads); Kestrel's own
// default is about 30 MB. A larger body gets a 413.
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 1024 * 1024);

// Errors that never reach a controller (an unknown route, an unhandled
// exception, a rejected body) get the same ProblemDetails shape as model errors.
builder.Services.AddProblemDetails();

// The sign-in demo's session (project plan section 10): the framework's own
// bearer token, sent in the Authorization header. The client (Vercel) and API
// (Render) are different sites, so a cookie would be third-party.
builder.Services
				.AddAuthentication(BearerTokenDefaults.AuthenticationScheme)
				.AddBearerToken();

builder.Services.AddAuthorization(options =>
{
	options.AddPolicy(
		AuthNames.TeamMemberPolicy,
		policy => policy.RequireClaim(AuthNames.KindClaim, nameof(AccountKind.TeamMember)));
	options.AddPolicy(
		AuthNames.PetParentPolicy,
		policy => policy.RequireClaim(AuthNames.KindClaim, nameof(AccountKind.PetParent)));
});

builder.Services.AddSignalR();

// The clinic's fixed shifts for the board summary (2.12a). Read now, so a
// missing or malformed Clinic setting stops startup.
builder.Services.AddSingleton(ClinicShifts.FromConfiguration(builder.Configuration));

var allowedOrigins = CorsOrigins.Read(builder.Configuration);

builder.Services.AddCors(options =>
{
	options.AddPolicy("VetiFlowClient", policy =>
	{
		policy
						.WithOrigins(allowedOrigins)
						.AllowAnyHeader()
						.AllowAnyMethod()
						.AllowCredentials();
	});
});

// Render terminates TLS and forwards the scheme and client address. Only the
// nearest proxy's values count, so a client cannot spoof its own address.
// Render publishes no fixed proxy addresses, and the container is reachable
// only through Render, so the known-proxy lists are cleared.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
	options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
	options.ForwardLimit = 1;
	options.KnownIPNetworks.Clear();
	options.KnownProxies.Clear();
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
		app.Logger,
		migrationConnectionString: app.Configuration.GetConnectionString("VetiFlowMigrations"));
}

// First, so everything after it sees the real scheme and client address.
app.UseForwardedHeaders();

// A generic 500 with no exception details. A body Kestrel rejected (too large,
// for example) keeps its own status instead of becoming a 500.
app.UseExceptionHandler(new ExceptionHandlerOptions
{
	StatusCodeSelector = exception => exception is BadHttpRequestException badRequest
		? badRequest.StatusCode
		: StatusCodes.Status500InternalServerError
});

app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
	app.MapOpenApi();
}
else
{
	app.UseHsts();
}

app.UseHttpsRedirection();

app.UseCors("VetiFlowClient");

app.UseAuthentication();

app.UseAuthorization();

app.MapControllers();

app.MapHub<CaseHub>("/hubs/cases");

app.Run();
