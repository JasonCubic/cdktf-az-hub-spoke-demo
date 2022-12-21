import { Construct } from 'constructs';
import MockOnPrem from '../L2-mock-on-prem/index.js';
import MicrosoftHubVNet from '../L2-microsoft-hub-vnet/index.js';
import MicrosoftSpoke from '../L2-microsoft-spoke/index.js';
import MicrosoftHubNVA from '../L2-microsoft-hub-nva/index.js';

// Inspired by: https://learn.microsoft.com/en-us/azure/developer/terraform/hub-spoke-introduction
// how to validate it's working: https://learn.microsoft.com/en-us/azure/developer/terraform/hub-spoke-validation#6-verify-the-results

class MicrosoftLearnHubSpokeTopology extends Construct {
  constructor(scope: Construct, name: string, options: {
    region: string,
    adminUsername: string,
    adminPassword: string,
  }) {
    super(scope, name);

    const mockOnPremConstruct = new MockOnPrem(this, 'mock-on-prem', {
      onPremLocation: options.region,
      prefixOnPrem: 'onPrem',
      adminUsername: options.adminUsername,
      adminPassword: options.adminPassword,
    });

    const hubVNetConstruct = new MicrosoftHubVNet(this, 'ms-hub-vnet', {
      hubLocation: options.region,
      prefixHub: 'hub',
      sharedKey: '4-v3ry-53cr37-1p53c-5h4r3d-k3y', // todo: hide this??
      onPremVpnGateway: mockOnPremConstruct.onPremVpnGateway,
      onPremVNetRg: mockOnPremConstruct.onPremVnetRg,
      adminUsername: options.adminUsername,
      adminPassword: options.adminPassword,
    });

    const spoke1Construct = new MicrosoftSpoke(this, 'spoke1', {
      prefixSpoke: 'spoke1',
      spokeLocation: options.region,
      hubVNet: hubVNetConstruct.hubVnet,
      hubVNetGateway: hubVNetConstruct.hubVnetGateway,
      spokeVnetAddressSpace: ['10.1.0.0/16'],
      subnetSpokeMgmtAddressPrefixes: ['10.1.0.64/27'],
      subnetSpokeWorkloadAddressPrefixes: ['10.1.1.0/24'],
      adminUsername: options.adminUsername,
      adminPassword: options.adminPassword,
    });

    const spoke2Construct = new MicrosoftSpoke(this, 'spoke2', {
      prefixSpoke: 'spoke2',
      spokeLocation: options.region,
      hubVNet: hubVNetConstruct.hubVnet,
      hubVNetGateway: hubVNetConstruct.hubVnetGateway,
      spokeVnetAddressSpace: ['10.2.0.0/16'],
      subnetSpokeMgmtAddressPrefixes: ['10.2.0.64/27'],
      subnetSpokeWorkloadAddressPrefixes: ['10.2.1.0/24'],
      adminUsername: options.adminUsername,
      adminPassword: options.adminPassword,
    });

    new MicrosoftHubNVA(this, 'hub-network-virtual-appliance', {
      hubNvaLocation: options.region,
      prefixHubNva: 'hub-nva',
      hubDmzSubnet: hubVNetConstruct.hubDmzSubnet,
      subnetHubGatewaySubnet: hubVNetConstruct.hubGatewaySubnet,
      spokeConstructs: [spoke1Construct, spoke2Construct],
      adminUsername: options.adminUsername,
      adminPassword: options.adminPassword,
    });
  }
}

export default MicrosoftLearnHubSpokeTopology;
