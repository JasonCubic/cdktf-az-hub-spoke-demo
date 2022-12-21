import { Construct } from 'constructs';
import { TerraformStack, TerraformVariable } from 'cdktf';
import AzureOidcProvider from '../../constructs/L1-azurerm-oidc-provider/index.js';
import QuickDevEnv from '../../constructs/quick-dev-env/index.js';

class MyStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    // tenantId and clientId are not secret so can be in a plain json file in the repo
    const tenantId = new TerraformVariable(this, 'tenantId', { type: 'string' }); // process.env.TF_VAR_tenantId
    const clientId = new TerraformVariable(this, 'clientId', { type: 'string' }); // process.env.TF_VAR_clientId

    // subscriptionId is not publicly available but it is tokenized.  Can be in plain text as long as the repo is not public (not available on the internet)
    const subscriptionId = new TerraformVariable(this, 'demoSubscriptionId', { type: 'string' }); // process.env.TF_VAR_demoSubscriptionId

    // clientSecret is a secret and can not appear in the repo
    const clientSecret = new TerraformVariable(this, 'clientSecret', { type: 'string', sensitive: true }); // process.env.TF_VAR_vmPassword

    new AzureOidcProvider(this, 'azure-provider', {
      useOidc: true,
      tenantId: tenantId.stringValue,
      subscriptionId: subscriptionId.stringValue,
      clientId: clientId.stringValue,
      clientSecret: clientSecret.stringValue,
      features: {},
    });

    new QuickDevEnv(this, 'quick-dev-env', 'East US');
  }
}

export default MyStack;
