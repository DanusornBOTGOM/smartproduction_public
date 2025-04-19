
FROM nginx:alpine

RUN rm /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/conf.d/

EXPOSE 5050

CMD ["nginx", "-g", "daemon off;"]


# RUN - docker-compose up -d --build