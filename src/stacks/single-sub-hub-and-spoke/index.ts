import { Construct } from 'constructs';
import { TerraformStack, TerraformVariable } from 'cdktf';
import AzureOidcProvider from '../../constructs/L1-azurerm-oidc-provider/index.js';
import MicrosoftLearnHubSpokeTopology from '../../constructs/L3-microsoft-learn-hub-spoke-topology/index.js';

// Inspired by: https://learn.microsoft.com/en-us/azure/developer/terraform/hub-spoke-introduction
// how to validate it's working: https://learn.microsoft.com/en-us/azure/developer/terraform/hub-spoke-validation#6-verify-the-results

class MyStack extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    // tenantId and clientId are not secret so can be in a plain json file in the repo
    const tenantId = new TerraformVariable(this, 'tenantId', { type: 'string' }); // process.env.TF_VAR_tenantId
    const clientId = new TerraformVariable(this, 'hubClientId', { type: 'string' }); // process.env.TF_VAR_hubClientId

    // subscriptionId is not publicly available but it is tokenized.  Can be in plain text as long as the repo is not public (not available on the internet)
    const subscriptionId = new TerraformVariable(this, 'hubSubscriptionId', { type: 'string' }); // process.env.TF_VAR_hubSubscriptionId

    // clientSecret is a secret and can not appear in the repo
    const clientSecret = new TerraformVariable(this, 'hubClientSecret', { type: 'string', sensitive: true }); // process.env.TF_VAR_hubClientSecret

    // NOTE: It is a best practice to only use TerraformVariable in stacks.
    // https://developer.hashicorp.com/terraform/cdktf/create-and-deploy/best-practices#read-secrets-with-terraform-variables

    new AzureOidcProvider(this, 'azure-provider', {
      useOidc: true,
      tenantId: tenantId.stringValue,
      subscriptionId: subscriptionId.stringValue,
      clientId: clientId.stringValue,
      clientSecret: clientSecret.stringValue,
      features: {},
    });

    const vmAdminUsername = new TerraformVariable(this, 'vmAdminUsername', { type: 'string', default: 'adminUser' }); // process.env.TF_VAR_vmAdminUsername
    const vmAdminPassword = new TerraformVariable(this, 'vmAdminPassword', { type: 'string', sensitive: true }); // process.env.TF_VAR_vmAdminPassword

    new MicrosoftLearnHubSpokeTopology(this, 'hub-and-spoke-topology', {
      region: 'East US',
      adminUsername: vmAdminUsername.stringValue,
      adminPassword: vmAdminPassword.stringValue,
    });
  }
}

export default MyStack;
