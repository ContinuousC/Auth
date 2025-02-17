[Keycloak admin portal](https://admin-sso.continuousc.contc).
For each developer an account with admin privileges will be created in Keycloak (password to be saved in bitwarden!)

# Create realm

[Docs](https://www.keycloak.org/docs/latest/server_admin/#proc-creating-a-realm_server_administration_guide)

# Realm settings

## Login

### Login screen customization

- user registration -> off
- forgot password -> on
- remember me -> on

### Email settings

- email as username -> on
- login with email -> on
- verify email -> on

## Email

[Docs](https://www.keycloak.org/docs/latest/server_admin/#_email)

## Themes

- Login theme -> Attributes
- Account theme -> keycloak.v3
- Admin theme -> phasetwo.v2
- Email theme -> Attributes

## Sessions

### SSO Session Settings

- SSO Session Idle -> 14 days
- SSO Session Max -> 365 days

## Tokens

### Access tokens

- Access Token Lifespan -> 5 min

# Authentication settings

## Flows

- At 'Org Browser Flow' click on the 3 vertical dots at the end, and choose bind flow
- Select Browser flow and click save

## Authentication

- Enable 'Invitation'

## Policies

### Password policy

- minimun length -> 8
- special characters -> 1
- Uppercase characters -> 1

# Client

## Click create client

### General settings

- client id -> app
- name -> app

### Capability config

- Client authentication -> on
- Authentication flow -> only select Standard flow

### Login settings

## Configure client

### Settings

#### Access settings

- Root & Home URL-> https://${DEVELOPER_INITALS}-app.continuousc.contc
- Valid redirect URIs -> /auth/calback
- Valid post logout redirect URIs -> /auth/login\*
- Web origins -> +

#### Login settings

- consent required -> off

#### Logout settings

- Front channel logout -> off

### Credentials

- Copy client secret=${CLIENT_SECRET}
- put in vault under oidc/sso.continuousc.contc/realms/${DEVELOPER_INITALS}/app
  - client-secret -> ${CLIENT_SECRET}

### Client scopes

- click app-dedicated
- Add mapper by configuration and there select (one-by-one=save and then reselect):
  - Active Organization
    - name -> Active Organization
    - Active Organization Properties -> id, name, role, attribute
    - Token Claim Name -> active_organization
    - Claim JSON Type -> JSON
    - Add to id token -> enabled
    - Add to user info -> enabled
  - Organization Attribute
    - name -> Organization Attribute
    - Token Claim Name -> organization_attribute
    - Claim JSON Type -> JSON
    - Add to id token -> enabled
    - Add to user info -> enabled
  - Organization Role
    - name -> Organization Role
    - Token Claim Name -> organization_role
    - Claim JSON Type -> JSON
    - Add to id token -> enabled
    - Add to user info -> enabled

# Users

## Create users

admin@continuousc.eu, editor@continuousc.eu and viewer@continuousc.eu

- email verified -> on
- name -> admin, editor and viewer respectively
- last name -> continuousc

## Configure each user

- create for each user credential and set temporary to false

# Organization

## Create

- name -> demo
- display name -> Demo
- domain -> continuousc.eu

## Configure

### Roles

- Add roles admin, editor and viewer

### Members

- add members admin@continuousc.eu, editor@continuousc.eu and viewer@continuousc.eu
- Click on the 3 dots of the end of the members and select 'assign roles'
  - admin@continuousc.eu -> select all roles
  - editor@continuousc.eu -> editor and viewer roles
  - viewer@continuousc.eu -> viewer role

### attribute

- add “prometheus_tenant” attribute to the organization (I would not configure this in organization, but rather statically in ingress)

# Creating a service account for a tenant

- Add client
  - Capability config
    - Client authentication: on
    - Authentication flow: Service account roles
  - Dedicated client scope
    - Add “Active organization” token mapper
- Add the service account to the tenant organization
  - Find: Client page -> Service account roles -> user link -> ID
  - Add member using PUT /realms/:realm/orgs/:orgId/members/:userId
  - [The last step currently cannot be done via the GUI](https://github.com/p2-inc/keycloak-orgs/pull/244)
- Get secret
  - Client secret (for Prometheus remote write)
  - Client page -> Credentials -> Client secret
