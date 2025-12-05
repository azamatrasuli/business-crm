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
ENV ASPNETCORE_ENVIRONMENT=Production

# Expose port (Render uses dynamic PORT)
EXPOSE 10000

# Run the application with dynamic port from Render
CMD ASPNETCORE_URLS=http://+:${PORT:-10000} dotnet YallaBusinessAdmin.Api.dll

