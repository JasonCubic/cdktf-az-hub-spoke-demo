import { Construct } from 'constructs';
import { TerraformStack, TerraformVariable } from 'cdktf';
import { VirtualNetworkPeering } from '@cdktf/provider-azurerm/lib/virtual-network-peering/index.js';
import AzureOidcProvider from '../../constructs/L1-azurerm-oidc-provider/index.js';
import HubDemoStack from '../hub-demo/index.js';
import SpokeDemoStack from '../spoke-demo/index.js';

interface PeerOptions {
  hub: HubDemoStack,
  spoke: SpokeDemoStack,
  allowVirtualNetworkAccess?: boolean,
  allowForwardedTraffic?: boolean,
  allowGatewayTransit?: boolean
}

class PeerHubDemoAndSpokeDemo extends TerraformStack {
  private hubProvider: AzureOidcProvider;

  private spokeProvider: AzureOidcProvider;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // tenantId and clientId are not secret so can be in a plain json file in the repo
    const tenantId = new TerraformVariable(this, 'tenantId', { type: 'string' }); // process.env.TF_VAR_tenantId
    const clientId = new TerraformVariable(this, 'netContribClientId', { type: 'string' }); // process.env.TF_VAR_netContribClientId

    // subscriptionId is not publicly available but it is tokenized.  Can be in plain text as long as the repo is not public (not available on the internet)
    const hubSubscriptionId = new TerraformVariable(this, 'hubSubscriptionId', { type: 'string' }); // process.env.TF_VAR_hubSubscriptionId
    const spokeSubscriptionId = new TerraformVariable(this, 'spokeSubscriptionId', { type: 'string' }); // process.env.TF_VAR_spokeSubscriptionId

    // clientSecret is a secret and can not appear in the repo
    const clientSecret = new TerraformVariable(this, 'netContribClientSecret', { type: 'string', sensitive: true }); // process.env.TF_VAR_netContribClientSecret

    this.hubProvider = new AzureOidcProvider(this, 'hub-azure-provider', {
      useOidc: true,
      alias: 'hub-azurerm-provider',
      tenantId: tenantId.stringValue,
      subscriptionId: hubSubscriptionId.stringValue,
      // NOTE: the client used has to have the rights to create VirtualNetworkPeering in both the hub and spoke subscriptions
      clientId: clientId.stringValue, // this service principal has network contributor on both the hub and spoke subscriptions
      clientSecret: clientSecret.stringValue,
      features: {},
    });

    this.spokeProvider = new AzureOidcProvider(this, 'spoke-azure-provider', {
      useOidc: true,
      alias: 'spoke-azurerm-provider',
      tenantId: tenantId.stringValue,
      subscriptionId: spokeSubscriptionId.stringValue,
      // NOTE: the client used has to have the rights to create VirtualNetworkPeering in both the hub and spoke subscriptions
      clientId: clientId.stringValue, // this service principal has network contributor on both the hub and spoke subscriptions
      clientSecret: clientSecret.stringValue,
      features: {},
    });
  }

  addVirtualNetworkPeering(params: PeerOptions) {
    const {
      hub,
      spoke,
      allowVirtualNetworkAccess = true,
      allowForwardedTraffic = false,
      allowGatewayTransit = false,
    } = params;

    // https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs/resources/virtual_network_peering
    new VirtualNetworkPeering(this, 'peer-hub-vnet-to-spoke-vnet', {
      name: 'peer-hub-vnet-to-spoke-vnet', // TODO: change this to a naming function
      resourceGroupName: hub.simpleHub.hubRg.name,
      virtualNetworkName: hub.simpleHub.simpleHubVNet.vNet.name,
      remoteVirtualNetworkId: spoke.simpleSpoke.simpleSpokeVNet.vNet.id,
      allowVirtualNetworkAccess,
      allowForwardedTraffic,
      allowGatewayTransit,
      provider: this.hubProvider,
    });

    new VirtualNetworkPeering(this, 'peer-spoke-vnet-to-hub-vnet', {
      name: 'peer-spoke-vnet-to-hub-vnet', // TODO: change this to a naming function
      resourceGroupName: spoke.simpleSpoke.spokeRg.name,
      virtualNetworkName: spoke.simpleSpoke.simpleSpokeVNet.vNet.name,
      remoteVirtualNetworkId: hub.simpleHub.simpleHubVNet.vNet.id,
      allowVirtualNetworkAccess,
      allowForwardedTraffic,
      allowGatewayTransit,
      provider: this.spokeProvider,
    });
  }
}

export default PeerHubDemoAndSpokeDemo;
