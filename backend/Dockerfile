# Build stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy solution and project files
COPY YallaBusinessAdmin.sln .
COPY Directory.Build.props .
COPY src/YallaBusinessAdmin.Api/YallaBusinessAdmin.Api.csproj src/YallaBusinessAdmin.Api/
COPY src/YallaBusinessAdmin.Application/YallaBusinessAdmin.Application.csproj src/YallaBusinessAdmin.Application/
COPY src/YallaBusinessAdmin.Domain/YallaBusinessAdmin.Domain.csproj src/YallaBusinessAdmin.Domain/
COPY src/YallaBusinessAdmin.Infrastructure/YallaBusinessAdmin.Infrastructure.csproj src/YallaBusinessAdmin.Infrastructure/

# Restore dependencies
RUN dotnet restore

# Copy source code
COPY . .

# Build and publish
RUN dotnet publish src/YallaBusinessAdmin.Api/YallaBusinessAdmin.Api.csproj -c Release -o /app/publish --no-restore

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# Copy published output
COPY --from=build /app/publish .

# Set environment variables
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Run the application
ENTRYPOINT ["dotnet", "YallaBusinessAdmin.Api.dll"]

