FROM php:8.2-fpm

# Arguments for user UID/GID matching host system for proper volume file permissions
ARG UID=1000
ARG GID=1000

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV COMPOSER_ALLOW_SUPERUSER=1

# Install system dependencies & libraries required for PHP extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    libzip-dev \
    libpq-dev \
    libicu-dev \
    zip \
    unzip \
    procps \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install PECL extensions (Redis for cache/queues)
RUN pecl install redis-6.0.2 \
    && docker-php-ext-enable redis

# Install core PHP extensions for Laravel, PostgreSQL and FinTech precision
RUN docker-php-ext-configure intl \
    && docker-php-ext-install -j$(nproc) \
        pdo_pgsql \
        pgsql \
        mbstring \
        exif \
        pcntl \
        bcmath \
        gd \
        zip \
        intl \
        opcache

# Copy latest Composer binary
COPY --from=composer:2.7 /usr/bin/composer /usr/bin/composer

# Copy custom PHP configuration
COPY docker/php/php.ini /usr/local/etc/php/conf.d/custom.ini

# Set working directory
WORKDIR /var/www/html

# Create or reconfigure www-data user with host UID and GID
RUN groupmod -o -g ${GID} www-data || groupadd -g ${GID} www-data \
    && usermod -o -u ${UID} -g www-data www-data \
    && chown -R www-data:www-data /var/www

USER www-data

EXPOSE 9000

CMD ["php-fpm"]
