ARG BUILD_FROM
FROM $BUILD_FROM

# Install nginx (lightweight HTTP server)
RUN apk add --no-cache nginx

# Create web root directory
RUN mkdir -p /var/www/homedash

# Copy the web application files
COPY webapp/ /var/www/homedash/

# Copy nginx configuration
COPY nginx.conf /etc/nginx/http.d/default.conf

# Copy run script
COPY run.sh /run.sh
RUN chmod +x /run.sh

# Expose port
EXPOSE 8099

CMD ["/run.sh"]
