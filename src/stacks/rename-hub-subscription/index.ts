import { Construct } from 'constructs';
import { LocalBackend, TerraformStack, TerraformVariable } from 'cdktf';
import { Subscription } from '@cdktf/provider-azurerm/lib/subscription/index.js';
import AzurermOidcProvider from '../../constructs/L1-azurerm-oidc-provider/index.js';

class SubRenameStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);
    new LocalBackend(this);

    // tenantId and clientId are not secret so can be in a plain json file in the repo
    const tenantId = new TerraformVariable(this, 'tenantId', { type: 'string' }); // process.env.TF_VAR_tenantId
    const clientId = new TerraformVariable(this, 'hubClientId', { type: 'string' }); // process.env.TF_VAR_hubClientId

    // subscriptionId is not publicly available but it is tokenized.  Can be in plain text as long as the repo is not public (not available on the internet)
    const subscriptionId = new TerraformVariable(this, 'hubSubscriptionId', { type: 'string' }); // process.env.TF_VAR_hubSubscriptionId

    // clientSecret is a secret and can not appear in the repo
    const clientSecret = new TerraformVariable(this, 'hubClientSecret', { type: 'string', sensitive: true }); // process.env.TF_VAR_hubClientSecret

    new AzurermOidcProvider(this, 'azure-provider', {
      useOidc: true,
      tenantId: tenantId.stringValue,
      subscriptionId: subscriptionId.stringValue,
      clientId: clientId.stringValue, // this service principal has owner on the hub subscription
      clientSecret: clientSecret.stringValue,
      features: {},
    });

    new Subscription(this, 'rename-hub-subscription', {
      subscriptionId: subscriptionId.stringValue,
      subscriptionName: 'subscription-hub-demo',
      // alias: 'Azure Subscription 1',
      lifecycle: {
        preventDestroy: true,
      },
    });
  }
}

export default SubRenameStack;
