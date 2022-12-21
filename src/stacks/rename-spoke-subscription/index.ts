import { Construct } from 'constructs';
import { TerraformStack, TerraformVariable } from 'cdktf';
import { Subscription } from '@cdktf/provider-azurerm/lib/subscription/index.js';
import AzureOidcProvider from '../../constructs/L1-azurerm-oidc-provider/index.js';

class SubRenameStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    // tenantId and clientId are not secret so can be in a plain json file in the repo
    const tenantId = new TerraformVariable(this, 'tenantId', { type: 'string' }); // process.env.TF_VAR_tenantId
    const clientId = new TerraformVariable(this, 'spokeClientId', { type: 'string' }); // process.env.TF_VAR_clientId

    // subscriptionId is not publicly available but it is tokenized.  Can be in plain text as long as the repo is not public (not available on the internet)
    const subscriptionId = new TerraformVariable(this, 'spokeSubscriptionId', { type: 'string' }); // process.env.TF_VAR_spokeSubscriptionId

    // clientSecret is a secret and can not appear in the repo
    const clientSecret = new TerraformVariable(this, 'spokeClientSecret', { type: 'string', sensitive: true }); // process.env.TF_VAR_spokeClientSecret

    new AzureOidcProvider(this, 'azure-provider', {
      useOidc: true,
      tenantId: tenantId.stringValue,
      subscriptionId: subscriptionId.stringValue,
      clientId: clientId.stringValue, // this service principal has owner on the spoke subscription
      clientSecret: clientSecret.stringValue,
      features: {},
    });

    new Subscription(this, 'rename-spoke-subscription', {
      subscriptionId: subscriptionId.stringValue,
      subscriptionName: 'subscription-spoke-demo',
      // alias: 'Pay-As-You-Go',
    });
  }
}

export default SubRenameStack;
