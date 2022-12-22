import { Construct } from 'constructs';
import { TerraformStack, TerraformVariable } from 'cdktf';
import { RoleAssignment } from '@cdktf/provider-azurerm/lib/role-assignment/index.js';
import { DataAzurermSubscription } from '@cdktf/provider-azurerm/lib/data-azurerm-subscription/index.js';
import { RoleDefinition } from '@cdktf/provider-azurerm/lib/role-definition/index.js';
import { DataAzurermClientConfig } from '@cdktf/provider-azurerm/lib/data-azurerm-client-config/index.js';
import AzureOidcProvider from '../../constructs/L1-azurerm-oidc-provider/index.js';

// this is an experiment / proof of concept
// this could be used to do peering with no extra long term service principals (SP)
// if you wanted to peer two virtual networks in different subscriptions
// it would look kind of like this in a ci/cd pipeline
// 1. hub has an owner SP, and spoke has an owner SP already set up
// 2. run the stacks so that the hub and spoke are created
// 3. run this stack to add the peering role to the two SP's for each others subscriptions
// 4. run the peering stack using only the two owners SP's (they have the custom peering role at this point)
// 5. run a destroy on this specific stack to remove the peering roles from the two owners SP's
// Note: you only need this peering role to apply peering.  You don't need it to destroy the vnet peering.

class PeerHubDemoAndSpokeDemo extends TerraformStack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    // tenantId and clientId are not secret so can be in a plain json file in the repo
    const tenantId = new TerraformVariable(this, 'tenantId', { type: 'string' }); // process.env.TF_VAR_tenantId
    const hubClientId = new TerraformVariable(this, 'hubClientId', { type: 'string' }); // process.env.TF_VAR_hubClientId
    const spokeClientId = new TerraformVariable(this, 'spokeClientId', { type: 'string' }); // process.env.TF_VAR_clientId

    // subscriptionId is not publicly available but it is tokenized.  Can be in plain text as long as the repo is not public (not available on the internet)
    const hubSubscriptionId = new TerraformVariable(this, 'hubSubscriptionId', { type: 'string' }); // process.env.TF_VAR_hubSubscriptionId
    const spokeSubscriptionId = new TerraformVariable(this, 'spokeSubscriptionId', { type: 'string' }); // process.env.TF_VAR_spokeSubscriptionId

    // clientSecret is a secret and can not appear in the repo
    const hubClientSecret = new TerraformVariable(this, 'hubClientSecret', { type: 'string', sensitive: true }); // process.env.TF_VAR_hubClientSecret
    const spokeClientSecret = new TerraformVariable(this, 'spokeClientSecret', { type: 'string', sensitive: true }); // process.env.TF_VAR_spokeClientSecret

    const hubProvider = new AzureOidcProvider(this, 'hub-azure-provider', {
      useOidc: true,
      alias: 'hub-azurerm-provider',
      tenantId: tenantId.stringValue,
      subscriptionId: hubSubscriptionId.stringValue,
      clientId: hubClientId.stringValue,
      clientSecret: hubClientSecret.stringValue,
      features: {},
    });

    const spokeProvider = new AzureOidcProvider(this, 'spoke-azure-provider', {
      useOidc: true,
      alias: 'spoke-azurerm-provider',
      tenantId: tenantId.stringValue,
      subscriptionId: spokeSubscriptionId.stringValue,
      clientId: spokeClientId.stringValue,
      clientSecret: spokeClientSecret.stringValue,
      features: {},
    });

    const hubSubscription = new DataAzurermSubscription(this, 'hub-subscription-data-obj', {
      provider: hubProvider,
    });

    const spokeSubscription = new DataAzurermSubscription(this, 'spoke-subscription-data-obj', {
      provider: spokeProvider,
    });

    const hubClient = new DataAzurermClientConfig(this, 'hub-provider-client', {
      provider: hubProvider,
    });

    const spokeClient = new DataAzurermClientConfig(this, 'spoke-provider-client', {
      provider: spokeProvider,
    });

    // These are the specific Azure rights needed to add peering on a remote virtual network
    // source: https://learn.microsoft.com/en-us/azure/virtual-network/virtual-network-manage-peering?tabs=peering-portal#permissions
    const azurePermissionActionsRequireForPeering = [
      'Microsoft.ClassicNetwork/virtualNetworks/peer/action',
      'Microsoft.Network/virtualNetworks/peer/action',
      'Microsoft.Network/virtualNetworks/virtualNetworkPeerings/read',
      'Microsoft.Network/virtualNetworks/virtualNetworkPeerings/write',
      'Microsoft.Network/virtualNetworks/virtualNetworkPeerings/delete',
    ];

    // https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/role_definition
    const hubRoleToAllowVnetPeering = new RoleDefinition(this, 'hub-allow-vnet-peering', {
      name: 'hub-virtual-network-peering',
      scope: hubSubscription.id,
      assignableScopes: [hubSubscription.id],
      provider: hubProvider,
      permissions: [{ actions: azurePermissionActionsRequireForPeering }],
    });

    // https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/role_definition
    const spokeRoleToAllowVnetPeering = new RoleDefinition(this, 'spoke-allow-vnet-peering', {
      name: 'spoke-virtual-network-peering',
      scope: spokeSubscription.id,
      assignableScopes: [spokeSubscription.id],
      provider: spokeProvider,
      permissions: [{ actions: azurePermissionActionsRequireForPeering }],
    });

    // https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/role_assignment
    new RoleAssignment(this, 'add-peering-role-to-spoke-sp-for-hub-subscription', {
      scope: hubSubscription.id,
      principalId: spokeClient.objectId,
      roleDefinitionId: hubRoleToAllowVnetPeering.roleDefinitionResourceId,
      skipServicePrincipalAadCheck: true, // without this the delete can take a long time
      provider: hubProvider,
    });

    // https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/role_assignment
    new RoleAssignment(this, 'add-peering-role-to-hub-sp-for-spoke-subscription', {
      scope: spokeSubscription.id,
      principalId: hubClient.objectId,
      roleDefinitionId: spokeRoleToAllowVnetPeering.roleDefinitionResourceId,
      skipServicePrincipalAadCheck: true, // without this the delete can take a long time
      provider: spokeProvider,
    });
  }
}

export default PeerHubDemoAndSpokeDemo;
