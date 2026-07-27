import Image from "next/image";

const Loading = () => {
  return (
    <div className="w-full h-full min-h-[240px] flex items-center justify-center py-10">
      <Image
        src="/images/Cravio_Shopping_Bag_Icon_.png"
        alt="loading"
        width={200}
        height={200}
        className="animate-bounce"
        priority
      />
    </div>
  );
};

export default Loading;
