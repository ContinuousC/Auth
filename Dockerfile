FROM gitea.contc/controlplane/techdocs-builder:0.0.7 AS docs
WORKDIR /app
RUN mkdir  -p /app/docs
COPY mkdocs.yml /app
COPY docs/* /app/docs
RUN npx @techdocs/cli generate --no-docker
ENV NODE_TLS_REJECT_UNAUTHORIZED=0
ENV AWS_REGION=us-west-2
RUN --mount=type=secret,id=minio_credentials,target=/root/.minio.env,required=true \
    export $(cat /root/.minio.env); \
    npx @techdocs/cli publish --publisher-type awsS3 --storage-name techdocs \
    --entity default/component/oidc-client --awsEndpoint https://minio.cortex --awsS3ForcePathStyle