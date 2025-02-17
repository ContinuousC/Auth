In repo 'ControlPlane/Configuration' update $cluster-name/applications/shared-auth-continuousc.yaml, example:

```
namespace: auth
helmChart:
  repository: https://gitea.contc/api/packages/ContinuousC/helm
  name: auth
  version: $helm-chart-version
  values: {}
```

Argocd will then deploy the application in the given cluster for the given tenant.
