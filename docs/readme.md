# OIDC client

The oidc client consist of the helm chart and Source code.
For the moment the chart is deployed in the app domain and in the tenant domain. The app domain use the oidc client to handle the login flow (shared functionalities for all tenants), while the tenant domain use the oidc-client for checking the access token with ForwardAuth traefik middleware and logout.

We want to refactor this in two steps:

- Oidc-client should be only one standalone service shared for all tenants. For the moment we deploy a shared one and in each chart for the tenant as helm depedency
- Convert oidc-client as traefik middleware plugin

We opted to use [Keycloak](https://www.keycloak.org/) as our IAM solutions with the keycloak [p2-extension](https://github.com/p2-inc/keycloak-orgs). Under [keycloak settings](./keycloak-settings.md) you can find how a keycloak realm is configured to work with C9C.

Other topics include [deployment procedure](./deployment.md) for the shared app domain oidc-client and the capabilities in the [user profile page](./profile-page.md).
