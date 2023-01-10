import { Construct } from 'constructs';
import { LocalBackend, TerraformStack, TerraformVariable } from 'cdktf';
import AzurermOidcProvider from '../../constructs/L1-azurerm-oidc-provider/index.js';
import SimpleSpoke from '../../constructs/simple-spoke/index.js';

class SpokeDemoStack extends TerraformStack {
  public simpleSpoke: SimpleSpoke;

  constructor(scope: Construct, id: string) {
    super(scope, id);
    new LocalBackend(this);

    // tenantId and clientId are not secret so can be in a plain json file in the repo
    const tenantId = new TerraformVariable(this, 'tenantId', { type: 'string' }); // process.env.TF_VAR_tenantId
    const clientId = new TerraformVariable(this, 'spokeClientId', { type: 'string' }); // process.env.TF_VAR_clientId

    // subscriptionId is not publicly available but it is tokenized.  Can be in plain text as long as the repo is not public (not available on the internet)
    const subscriptionId = new TerraformVariable(this, 'spokeSubscriptionId', { type: 'string' }); // process.env.TF_VAR_spokeSubscriptionId

    // clientSecret is a secret and can not appear in the repo
    const clientSecret = new TerraformVariable(this, 'spokeClientSecret', { type: 'string', sensitive: true }); // process.env.TF_VAR_spokeClientSecret

    new AzurermOidcProvider(this, 'azure-provider', {
      useOidc: true,
      tenantId: tenantId.stringValue,
      subscriptionId: subscriptionId.stringValue,
      clientId: clientId.stringValue, // this service principal has owner on the spoke subscription
      clientSecret: clientSecret.stringValue,
      features: {},
    });

    this.simpleSpoke = new SimpleSpoke(this, 'simple-spoke-demo', {
      // region: 'East US',
      region: 'eastus',
      vNetAddressSpace: ['10.101.0.0/16'],
      subnetAddressPrefixes: ['10.101.1.0/24'],
    });
  }
}

export default SpokeDemoStack;
