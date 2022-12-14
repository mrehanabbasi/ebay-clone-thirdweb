import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Header from '../../components/Header';
import {
  useContract,
  useNetwork,
  useNetworkMismatch,
  useMakeBid,
  useOffers,
  useMakeOffer,
  useBuyNow,
  MediaRenderer,
  useAddress,
  useListing,
  useAcceptDirectListingOffer,
} from '@thirdweb-dev/react';
import { UserCircleIcon } from '@heroicons/react/24/solid';
import { ListingType, NATIVE_TOKENS } from '@thirdweb-dev/sdk';
import Countdown from 'react-countdown';
import network from '../../utils/network';
import { ethers } from 'ethers';
import toast from 'react-hot-toast';

function ListingPage() {
  const router = useRouter();
  const address = useAddress();
  const { listingId } = router.query as { listingId: string };
  const [bidAmount, setBidAmount] = useState('');
  const [, switchNetwork] = useNetwork();
  const networkMismatch = useNetworkMismatch();

  const [minimumNextBid, setMinimumNextBid] = useState<{
    displayValue: string;
    symbol: string;
  }>();

  const { contract } = useContract(
    process.env.NEXT_PUBLIC_MARKETPLACE_CONTRACT,
    'marketplace'
  );

  const { mutate: makeBid } = useMakeBid(contract);

  const { data: offers } = useOffers(contract, listingId);

  const { mutate: makeOffer } = useMakeOffer(contract);

  const { mutate: buyNow } = useBuyNow(contract);

  const { data: listing, isLoading, error } = useListing(contract, listingId);

  const { mutate: acceptOffer } = useAcceptDirectListingOffer(contract);

  useEffect(() => {
    if (!listingId || !contract || !listing) return;

    if (listing.type === ListingType.Auction) {
      fetchMinimumNextBid();
    }
  }, [listingId, listing, contract]);

  const fetchMinimumNextBid = async () => {
    if (!listingId || !contract) return;

    const { displayValue, symbol } = await contract.auction.getMinimumNextBid(
      listingId
    );

    setMinimumNextBid({
      displayValue: displayValue,
      symbol: symbol,
    });
  };

  const formatPlaceholder = () => {
    if (!listing) return;

    if (listing.type === ListingType.Direct) {
      return 'Enter offer amount';
    }

    if (listing.type === ListingType.Auction) {
      return Number(minimumNextBid?.displayValue) === 0
        ? 'Enter bid amount'
        : `${minimumNextBid?.displayValue} ${minimumNextBid?.symbol} or more`;
    }
  };

  const successNotif = (message: string) => {
    return toast.success(message, {
      className: 'border border-solid border-green-600',
    });
  };

  const errorNotif = (message: string) => {
    return toast.error(message, {
      className: 'border border-solid border-red-600',
    });
  };

  const loadingNotif = (message: string) => {
    return toast.loading(() => (
      <div className="flex items-center">
        <div>{message}</div>
        <div className="hidden md:inline max-h-50 p-5">
          <MediaRenderer src={listing?.asset.image} />
        </div>
      </div>
    ));
  };

  const buyNft = async () => {
    const buyingNftToast = loadingNotif('Buying NFT...');

    if (networkMismatch) {
      switchNetwork && switchNetwork(network);
      return;
    }

    if (!listingId || !contract || !listing) return;

    await buyNow(
      {
        id: listingId,
        buyAmount: 1,
        type: listing.type,
      },
      {
        onSuccess(data, variables, context) {
          toast.remove(buyingNftToast);
          successNotif('NFT bought successfully');
          console.log('SUCCESS', data, variables, context);
          router.replace('/');
        },
        onError(error, variables, context) {
          toast.remove(buyingNftToast);
          errorNotif('NFT could not be bought');
          console.error('ERROR', error, variables, context);
        },
      }
    );
  };

  const createBidOrOffer = async () => {
    const biddingOnNftToast = loadingNotif('Bidding on NFT...');

    try {
      if (networkMismatch) {
        switchNetwork && switchNetwork(network);
        return;
      }

      // Direct Listing
      if (listing?.type === ListingType.Direct) {
        if (
          listing.buyoutPrice.toString() ===
          ethers.utils.parseEther(bidAmount).toString()
        ) {
          console.log('Buyout Price met. Buying NFT...');

          toast.remove(biddingOnNftToast);
          buyNft();
          return;
        }

        console.log('Buyout price not met. Making offer...');
        toast.remove(biddingOnNftToast);
        const makingOfferToast = loadingNotif('Making offer...');
        await makeOffer(
          {
            quantity: 1,
            listingId,
            pricePerToken: bidAmount,
          },
          {
            onSuccess(data, variables, context) {
              toast.remove(makingOfferToast);
              successNotif('Offer made successfully');
              console.log('SUCCESS', data, variables, context);
              setBidAmount('');
            },
            onError(error, variables, context) {
              toast.remove(makingOfferToast);
              errorNotif('Offer could not be made');
              console.error('ERROR', error, variables, context);
            },
          }
        );
      }

      // Auction Listing
      if (listing?.type === ListingType.Direct) {
        console.log('Making bid...');
        await makeBid(
          {
            listingId,
            bid: bidAmount,
          },
          {
            onSuccess(data, variables, context) {
              toast.remove(biddingOnNftToast);
              successNotif('Bid made successfully');
              console.log('SUCCESS', data, variables, context);
              setBidAmount('');
            },
            onError(error, variables, context) {
              toast.remove(biddingOnNftToast);
              errorNotif('Bid could not be made');
              console.error('ERROR:', error, variables, context);
            },
          }
        );
      }
    } catch (error) {
      toast.remove(biddingOnNftToast);
      console.error(error);
    }
  };

  if (isLoading) {
    return (
      <div>
        <Header />
        <div className="text-center animate-pulse text-blue-500">
          Loading Item...
        </div>
      </div>
    );
  }

  if (!listing) {
    return <div>Listing not found!</div>;
  }

  return (
    <div>
      <Header />

      <main className="max-w-6xl mx-auto p-2 flex flex-col lg:flex-row space-y-10 space-x-5 pr-10">
        <div className="p-10 border mx-auto lg:mx-0 max-w-md lg:max-w-xl">
          <MediaRenderer src={listing?.asset.image} />
        </div>

        <section className="flex-1 space-y-5 pb-20 lg:pb-0">
          <div>
            <h1 className="text-xl font-bold">{listing.asset.name}</h1>
            <p className="text-gray-600">{listing.asset.description}</p>
            <p className="flex items-center text-xs sm:text-base">
              <UserCircleIcon className="h-5" />
              <span className="font-bold pr-1">Seller: </span>
              {listing.sellerAddress}
            </p>
          </div>

          <div className="grid grid-cols-2 items-center py-2">
            <p className="font-bold">Listing Type:</p>
            <p>
              {listing.type === ListingType.Direct
                ? 'Direct Listing'
                : 'Auction Listing'}
            </p>

            <p className="font-bold">Buy it now Price:</p>
            <p className="text-4xl font-bold">
              {listing.buyoutCurrencyValuePerToken.displayValue}{' '}
              {listing.buyoutCurrencyValuePerToken.symbol}
            </p>

            <button
              onClick={buyNft}
              className="col-start-2 mt-2 bg-blue-600 font-bold text-white rounded-full w-44 py-4 px-10"
            >
              Buy Now
            </button>
          </div>

          {listing.type === ListingType.Direct && offers && (
            <div className="grid grid-cols-2 gap-y-2">
              <p className="font-bold">Offers: </p>
              <p className="font-bold">
                {offers.length > 0 ? offers.length : 0}
              </p>

              {offers.map((offer) => (
                <>
                  <p className="flex items-center ml-5 text-sm italic">
                    <UserCircleIcon className="h-3 mr-2" />
                    {offer.offeror.slice(0, 5) +
                      '...' +
                      offer.offeror.slice(-5)}
                  </p>
                  <div>
                    <p
                      key={
                        offer.listingId +
                        offer.offeror +
                        offer.totalOfferAmount.toString()
                      }
                      className="text-sm italic"
                    >
                      {ethers.utils.formatEther(offer.totalOfferAmount)}{' '}
                      {NATIVE_TOKENS[network].symbol}
                    </p>

                    {listing.sellerAddress === address && (
                      <button
                        onClick={() =>
                          acceptOffer(
                            {
                              listingId,
                              addressOfOfferor: offer.offeror,
                            },
                            {
                              onSuccess(data, variables, context) {
                                successNotif('Offer accepted successfully');
                                console.log(
                                  'SUCCESS',
                                  data,
                                  variables,
                                  context
                                );
                                router.replace('/');
                              },
                              onError(error, variables, context) {
                                errorNotif('Offer could not be accepted');
                                console.error(
                                  'ERROR',
                                  error,
                                  variables,
                                  context
                                );
                              },
                            }
                          )
                        }
                        className="p-4 w-32 bg-red-500/50 rounded-lg font-bold text-xs cursor-pointer"
                      >
                        Accept Offer
                      </button>
                    )}
                  </div>
                </>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 space-y-2 items-center justify-end">
            <hr className="col-span-2" />

            <p className="col-span-2 font-bold">
              {listing.type === ListingType.Direct
                ? 'Make and Offer'
                : 'Bid on this Auction'}
            </p>

            {listing.type === ListingType.Auction && (
              <>
                <p>Current Minimum Bid:</p>
                <p className="font-bold">
                  {minimumNextBid?.displayValue} {minimumNextBid?.symbol}
                </p>

                <p>Time Remaining:</p>
                <Countdown
                  date={Number(listing.endTimeInEpochSeconds.toString()) * 1000}
                />
              </>
            )}

            <input
              className="border p-2 rounded-lg mr-5"
              type="text"
              onChange={(e) => setBidAmount(e.target.value)}
              placeholder={formatPlaceholder()}
            />
            <button
              onClick={createBidOrOffer}
              className="bg-red-600 font-bold text-white rounded-full w-44 py-4 px-10"
            >
              {listing.type === ListingType.Direct ? 'Offer' : 'Bid'}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

export default ListingPage;
